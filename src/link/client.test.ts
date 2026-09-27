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
})
