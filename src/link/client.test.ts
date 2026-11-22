import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { createBrainLink, type LinkSnapshot } from './client.ts'
import {
  Kind,
  Topics,
  DeviceRole,
  ProtocolDefaults,
  SequenceCounter,
  newEnvelope,
  encode,
  decode,
  type HelloPayload,
  type CapabilityManifestPayload,
} from '../protocol/index.ts'

/**
 * S0.3. The socket is injected so these run with no Brain and no network — what is under test is
 * the handshake we send and how we react to what comes back.
 */

class FakeSocket {
  static last: FakeSocket | undefined
  sent: string[] = []
  closed = false
  onopen?: () => void
  onmessage?: (event: { data: string }) => void
  onerror?: () => void
  onclose?: () => void

  // Declared explicitly: node's strip-only TypeScript mode rejects parameter properties.
  url: string

  constructor(url: string) {
    this.url = url
    FakeSocket.last = this
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.closed = true
    this.onclose?.()
  }

  /** Pretend the Brain sent this. */
  deliver(envelope: unknown): void {
    this.onmessage?.({ data: encode(envelope as never) })
  }
}

const hubSeq = new SequenceCounter()

function welcome(accepted: boolean, reason?: string) {
  return newEnvelope({
    kind: Kind.ACK,
    topic: Topics.SYS_WELCOME,
    payload: { accepted, ...(reason ? { reason } : {}) },
    seq: hubSeq,
  })
}

function manifest(capabilities: CapabilityManifestPayload['capabilities']) {
  return newEnvelope({
    kind: Kind.EVT,
    topic: Topics.CAP_MANIFEST,
    payload: { capabilities },
    seq: hubSeq,
  })
}

function pose(x: number, y: number, yaw: number) {
  return newEnvelope({
    kind: Kind.TELEM,
    topic: Topics.STATE_POSE,
    payload: { x, y, yaw, confidence: 0.9 },
    seq: hubSeq,
  })
}

describe('createBrainLink', () => {
  let seen: LinkSnapshot[]

  function start() {
    seen = []
    const link = createBrainLink({
      socketFactory: (url) => new FakeSocket(url) as unknown as WebSocket,
      onChange: (s) => seen.push({ ...s }),
    })
    return { link, socket: FakeSocket.last! }
  }

  beforeEach(() => {
    FakeSocket.last = undefined
  })

  it('dials the Brain and announces itself as a synapse', () => {
    const { link, socket } = start()
    socket.onopen!()

    assert.equal(socket.url, ProtocolDefaults.DEFAULT_BRAIN_URL)
    assert.equal(socket.sent.length, 1)

    const hello = decode(socket.sent[0]!)
    assert.equal(hello.topic, Topics.SYS_HELLO)
    assert.equal(hello.kind, Kind.CMD)

    const payload = hello.payload as HelloPayload
    // ENVELOPE.md §8: role tells the hub which registry slot this connection occupies.
    assert.equal(payload.role, DeviceRole.SYNAPSE)
    assert.equal(payload.protocol_version, ProtocolDefaults.PROTOCOL_VERSION)

    link.stop()
  })

  it('reports connected only once the hub accepts the handshake', () => {
    const { link, socket } = start()
    socket.onopen!()
    assert.equal(link.snapshot().status, 'connecting')

    socket.deliver(welcome(true))
    assert.equal(link.snapshot().status, 'connected')

    link.stop()
  })

  it('surfaces a refusal as its stated reason rather than retrying quietly', () => {
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(false, 'Unauthenticated token'))

    assert.equal(link.snapshot().status, 'offline')
    // A bad token is not a transport problem, and the user should not watch it retry forever.
    assert.equal(link.snapshot().reason, 'Unauthenticated token')

    link.stop()
  })

  it('records a relayed manifest verbatim, notes and reasons included', () => {
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))
    socket.deliver(
      manifest({
        driving: { state: 'available' },
        docking: { state: 'unavailable', reason: 'no dock in the map yet' },
        'local-voice': { state: 'degraded', note: 'offline — simple phrasing only' },
      }),
    )

    const snap = link.snapshot()
    assert.deepEqual(snap.capabilities['docking'], {
      state: 'unavailable',
      reason: 'no dock in the map yet',
    })
    assert.deepEqual(snap.capabilities['local-voice'], {
      state: 'degraded',
      note: 'offline — simple phrasing only',
    })
    assert.ok(snap.halfAtMs.heart)

    link.stop()
  })

  it('merges a second manifest instead of replacing the first', () => {
    // The two halves may arrive as separate messages; the app shows the union.
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))
    socket.deliver(manifest({ driving: { state: 'available' } }))
    socket.deliver(manifest({ memory: { state: 'available' } }))

    assert.deepEqual(Object.keys(link.snapshot().capabilities).sort(), ['driving', 'memory'])

    link.stop()
  })

  it('records the robot pose as telemetry arrives (M-83)', () => {
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))
    assert.equal(link.snapshot().pose, undefined)

    socket.deliver(pose(1.5, 2, 0.25))

    assert.deepEqual(link.snapshot().pose, { x: 1.5, y: 2, yaw: 0.25, confidence: 0.9 })
    assert.ok(link.snapshot().poseAtMs, 'the arrival time is kept so the map can age the marker')

    link.stop()
  })

  it('keeps only the latest pose — telemetry is a reading of now, not a log', () => {
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))
    socket.deliver(pose(0, 0, 0))
    socket.deliver(pose(3, 4, 1))

    assert.equal(link.snapshot().pose!.x, 3)
    assert.equal(link.snapshot().pose!.y, 4)

    link.stop()
  })

  it('decodes a map snapshot and records battery telemetry from the wire', () => {
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))
    socket.deliver(newEnvelope({
      kind: Kind.TELEM,
      topic: Topics.MAP_SNAPSHOT,
      payload: { width: 4, height: 3, resolution: 0.05, origin: { x: -3.952, y: -2.949 }, cells: [0, 4, 1, 3, 2, 1, 1, 4] },
      seq: hubSeq,
    }))
    socket.deliver(newEnvelope({
      kind: Kind.TELEM,
      topic: Topics.STATE_BATTERY,
      payload: { percentage: 95, voltage: 12.2, is_charging: false },
      seq: hubSeq,
    }))

    assert.deepEqual([...link.snapshot().map!.cells], [0, 0, 0, 0, 1, 1, 1, 2, 1, 1, 1, 1])
    assert.deepEqual(link.snapshot().map!.origin, { x: -3.952, y: -2.949 })
    assert.equal(link.snapshot().battery?.percentage, 95)
    assert.ok(link.snapshot().mapAtMs && link.snapshot().batteryAtMs)
    link.stop()
  })

  it("stamps each half separately, so the Brain's ticks cannot keep a dead robot fresh", async () => {
    // S1.4: kill the Fake Heart and the robot must go stale while the Brain half stays live.
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))
    socket.deliver(manifest({ driving: { state: 'available' } }))
    const heartAt = link.snapshot().halfAtMs.heart
    assert.ok(heartAt)
    assert.equal(link.snapshot().halfAtMs.brain, undefined)

    await new Promise((r) => setTimeout(r, 5))
    socket.deliver(manifest({ memory: { state: 'unavailable', reason: "Memory isn't built yet." } }))

    assert.equal(link.snapshot().halfAtMs.heart, heartAt, 'a Brain tick must not refresh the robot')
    assert.ok(link.snapshot().halfAtMs.brain! > heartAt)

    link.stop()
  })

  it('heartbeats every 5 s once connected, so the Brain does not drop it as dead', (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] })
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))
    const before = socket.sent.length

    t.mock.timers.tick(ProtocolDefaults.HEARTBEAT_INTERVAL_MS)
    socket.deliver(welcome(true)) // any inbound frame counts as life

    const beats = socket.sent.slice(before).map((raw) => decode(raw) as { kind: string; topic: string })
    assert.deepEqual(beats.map((b) => [b.kind, b.topic]), [[Kind.EVT, Topics.SYS_HEARTBEAT]])
    assert.equal(link.snapshot().status, 'connected')

    link.stop()
  })

  it('goes offline once the Brain has been silent for three beats, without waiting for a close', (t) => {
    // A pulled router does not close the socket — it just goes quiet. That is the S1.4 demo.
    t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] })
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))

    t.mock.timers.tick(ProtocolDefaults.HEARTBEAT_TIMEOUT_MS)

    assert.equal(link.snapshot().status, 'offline')
    assert.equal(link.snapshot().reason, "Can't reach the Brain right now.")

    link.stop()
  })

  it('ignores a malformed frame rather than tearing down the link', () => {
    // CLAUDE.md: "Nothing disconnects the peer except an authentication failure."
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))

    socket.onmessage!({ data: 'not json at all' })

    assert.equal(link.snapshot().status, 'connected')
    assert.equal(socket.closed, false)

    link.stop()
  })

  it('goes offline with a plain reason when the socket closes', () => {
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))
    socket.onclose!()

    assert.equal(link.snapshot().status, 'offline')
    assert.match(link.snapshot().reason ?? '', /Brain/)

    link.stop()
  })

  it('stops reconnecting once stopped', () => {
    const { link, socket } = start()
    socket.onopen!()
    link.stop()

    const before = FakeSocket.last
    socket.onclose!()
    assert.equal(FakeSocket.last, before, 'no new socket should be opened after stop()')
  })

  /** Connects, sends one `nav.goto`, and hands back the command as it went out on the wire. */
  function ask() {
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))
    const outcome = link.command(Topics.NAV_GOTO, { goal_id: 'goal-1', x: 1.5, y: 2 })
    return { link, socket, outcome, sent: decode(socket.sent[socket.sent.length - 1]!) }
  }

  /** The Brain's answer to a command: same `corr_id`, its own sequence (ENVELOPE.md §3). */
  function ack(corrId: string, accepted: boolean, reason?: string) {
    return newEnvelope({
      kind: Kind.ACK,
      topic: Topics.NAV_GOTO,
      corr_id: corrId,
      payload: { accepted, ...(reason ? { reason } : {}) },
      seq: hubSeq,
    })
  }

  it('asks the Brain to navigate as a command, and waits for its answer (M-84)', async () => {
    const { link, socket, outcome, sent } = ask()

    assert.equal(sent.kind, Kind.CMD)
    assert.equal(sent.topic, Topics.NAV_GOTO)
    assert.deepEqual(sent.payload, { goal_id: 'goal-1', x: 1.5, y: 2 })

    // Writing to the socket is not an answer: an ACK for some other command settles nothing.
    let settled = false
    void outcome.then(() => (settled = true))
    socket.deliver(ack('someone-elses', true))
    await Promise.resolve()
    assert.equal(settled, false)

    socket.deliver(ack(sent.corr_id, true))
    assert.deepEqual(await outcome, { status: 'accepted' })

    link.stop()
  })

  it('reports a refusal with the reason the Brain gave, not as a success', async () => {
    const { link, socket, outcome, sent } = ask()

    socket.deliver(ack(sent.corr_id, false, 'low_battery'))

    assert.deepEqual(await outcome, { status: 'rejected', reason: 'low_battery' })
    link.stop()
  })

  it('gives up when the Brain never answers, instead of leaving the tap hanging', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const { link, outcome } = ask()

    t.mock.timers.tick(ProtocolDefaults.DEFAULT_COMMAND_TIMEOUT_MS)

    assert.deepEqual(await outcome, { status: 'failed', reason: "The Brain didn't answer." })
    link.stop()
  })

  it('fails a waiting command when the connection drops or the link is stopped', async () => {
    const dropped = ask()
    dropped.socket.onclose!()
    assert.deepEqual(await dropped.outcome, {
      status: 'failed',
      reason: "Can't reach the Brain right now.",
    })
    dropped.link.stop()

    const stopped = ask()
    stopped.link.stop()
    assert.equal((await stopped.outcome).status, 'failed')
  })

  it('does not send before the handshake is accepted, and says why', async () => {
    const { link, socket } = start()
    socket.onopen!()

    const outcome = await link.command(Topics.NAV_GOTO, { goal_id: 'g', x: 0, y: 0 })

    assert.deepEqual(outcome, { status: 'failed', reason: "Can't reach the Brain right now." })
    assert.equal(socket.sent.filter((raw) => decode(raw).topic === Topics.NAV_GOTO).length, 0)

    link.stop()
  })

  it('shows a sys.approval as pending and answers it with an ACK on the same request (S5.1)', () => {
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))
    const request = newEnvelope({
      kind: Kind.CMD,
      topic: Topics.SYS_APPROVAL,
      idem_key: 'approval-ap-1',
      expires_at: Date.now() + 60_000,
      payload: { approval_id: 'ap-1', tool_name: 'open_app_or_url', args: { name: 'Spotify' }, expires_at: Date.now() + 60_000 },
      seq: hubSeq,
    })
    socket.deliver(request)
    assert.deepEqual(seen.at(-1)!.approvals.map((a) => a.approval_id), ['ap-1'])

    assert.equal(link.answerApproval('ap-1', true), true)
    const answer = decode(socket.sent.at(-1)!)
    assert.equal(answer.kind, Kind.ACK)
    assert.equal(answer.corr_id, request.corr_id)
    assert.deepEqual(answer.payload, { accepted: true })
    assert.deepEqual(seen.at(-1)!.approvals, [])
    assert.equal(link.answerApproval('ap-1', true), false, 'an answered request cannot be answered twice')
    link.stop()
  })

  it('drops pending approvals when the link drops, since only that connection may answer', () => {
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))
    socket.deliver(newEnvelope({
      kind: Kind.CMD, topic: Topics.SYS_APPROVAL, idem_key: 'approval-ap-2', expires_at: Date.now() + 60_000,
      payload: { approval_id: 'ap-2', tool_name: 't', args: {}, expires_at: Date.now() + 60_000 }, seq: hubSeq,
    }))
    socket.close()
    assert.deepEqual(seen.at(-1)!.approvals, [])
    assert.equal(link.answerApproval('ap-2', true), false)
    link.stop()
  })

  it('keeps the paired laptops the Brain lists, and ignores a malformed list', () => {
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))
    const devices = [{ device_id: 'stb-laptop', name: 'stb-laptop', paired_at: '2026-11-18T03:38:05Z', online: true }]
    socket.deliver(newEnvelope({ kind: Kind.EVT, topic: Topics.SYS_DEVICES, payload: { devices }, seq: hubSeq }))
    assert.deepEqual(seen.at(-1)!.pairedDevices, devices)
    socket.deliver(newEnvelope({ kind: Kind.EVT, topic: Topics.SYS_DEVICES, payload: { devices: [{ device_id: 'x' }] } as never, seq: hubSeq }))
    assert.deepEqual(seen.at(-1)!.pairedDevices, devices)
    link.stop()
  })

  it('takes the kill switch from sys.devices, and hands back the audit view from its ACK only (S5.2, S5.3)', async () => {
    const { link, socket } = start()
    socket.onopen!()
    socket.deliver(welcome(true))
    socket.deliver(newEnvelope({ kind: Kind.EVT, topic: Topics.SYS_DEVICES, payload: { devices: [], killswitch_active: true }, seq: hubSeq }))
    assert.equal(seen.at(-1)!.killswitchActive, true)

    const outcome = link.command(Topics.SYS_AUDIT, { limit: 50 })
    const sent = decode(socket.sent[socket.sent.length - 1]!)
    const audit = { entries: [{ id: 1, at_ms: 1, event: 'killswitch_on' as const, approved_by: 'synapse-app', prev_hash: '', hash: 'ab' }], chain: { ok: true, checked: 1 } }
    socket.deliver(newEnvelope({ kind: Kind.ACK, topic: Topics.SYS_AUDIT, corr_id: sent.corr_id, payload: { accepted: true, audit }, seq: hubSeq }))
    assert.deepEqual(await outcome, { status: 'accepted', audit })
    assert.equal('audit' in seen.at(-1)!, false, 'the log is never kept in the snapshot')
    link.stop()
  })
})
