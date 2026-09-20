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
    assert.ok(snap.manifestAtMs)

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
