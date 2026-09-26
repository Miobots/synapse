/**
 * S0.3 — the app's link to the Brain hub.
 *
 * Synapse dials out, exactly as Heart and Ganglion do (ENVELOPE.md §8: "Heart, Synapse, and
 * Ganglion dial out. Brain never dials."). Envelope construction, the codec, the backoff shape
 * and every timing constant come from `@miobots/protocol` — this file owns none of them.
 *
 * Uses the global WebSocket, which React Native provides. The `ws` package is Node-only and is
 * deliberately not a dependency here; the protocol barrel does not pull it in.
 */

import {
  Kind,
  Topics,
  DeviceRole,
  ProtocolDefaults,
  SequenceCounter,
  newEnvelope,
  encode,
  parse,
  type CapabilityManifestPayload,
  type CapabilityStatus,
  type HelloPayload,
  type WelcomePayload,
} from '../protocol/index.ts'

export type LinkStatus = 'connecting' | 'connected' | 'offline'

export interface LinkSnapshot {
  status: LinkStatus
  /** Capabilities as last published, keyed by capability id. Empty until a manifest arrives. */
  capabilities: Record<string, CapabilityStatus>
  /** When the most recent manifest arrived. Undefined if none has. */
  manifestAtMs?: number
  /** Why the link is down, when we know. Rendered to the user, so it stays plain. */
  reason?: string
}

export interface BrainLinkOptions {
  url?: string
  token?: string
  deviceId?: string
  /** Injected in tests; defaults to the platform's WebSocket. */
  socketFactory?: (url: string) => WebSocket
  onChange: (snapshot: LinkSnapshot) => void
}

/**
 * Connects, re-connects, and reports what it knows.
 *
 * Deliberately not a React hook: the reconnect timer and socket outlive any single render, and a
 * hook that owned them would tear the connection down on every dependency change.
 */
export function createBrainLink(options: BrainLinkOptions) {
  const url = options.url ?? ProtocolDefaults.DEFAULT_BRAIN_URL
  const token = options.token ?? ProtocolDefaults.DEFAULT_DEV_TOKEN
  const deviceId = options.deviceId ?? 'synapse-app'
  const open = options.socketFactory ?? ((target: string) => new WebSocket(target))

  let socket: WebSocket | undefined
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let backoffMs: number = ProtocolDefaults.RECONNECT_INITIAL_DELAY_MS
  let outboundSeq = new SequenceCounter()
  let stopped = false
  /**
   * A refusal the hub actually stated, kept across the close it causes.
   *
   * Closing after a rejected handshake fires onclose, which would otherwise overwrite
   * "Unauthenticated token" with the generic transport reason — so a bad token would read to the
   * user as a flaky network and retry forever without ever saying why.
   */
  let statedRefusal: string | undefined

  let snapshot: LinkSnapshot = { status: 'connecting', capabilities: {} }

  function publish(next: Partial<LinkSnapshot>): void {
    snapshot = { ...snapshot, ...next }
    options.onChange(snapshot)
  }

  /**
   * Exponential backoff with jitter. ENVELOPE.md §8: "Without it, everything that dropped when the
   * router rebooted reconnects at exactly the same instant, repeatedly."
   */
  function nextDelayMs(): number {
    const spread =
      ProtocolDefaults.RECONNECT_JITTER_MAX_FACTOR - ProtocolDefaults.RECONNECT_JITTER_MIN_FACTOR
    const factor = ProtocolDefaults.RECONNECT_JITTER_MIN_FACTOR + Math.random() * spread
    return Math.round(backoffMs * factor)
  }

  function scheduleReconnect(reason: string): void {
    if (stopped || reconnectTimer) return
    publish({ status: 'offline', reason: statedRefusal ?? reason })

    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined
      backoffMs = Math.min(
        backoffMs * ProtocolDefaults.RECONNECT_BACKOFF_MULTIPLIER,
        ProtocolDefaults.RECONNECT_MAX_DELAY_MS,
      )
      connect()
    }, nextDelayMs())
  }

  function connect(): void {
    if (stopped) return

    outboundSeq = new SequenceCounter()
    publish({ status: 'connecting' })

    const ws = open(url)
    socket = ws

    ws.onopen = () => {
      backoffMs = ProtocolDefaults.RECONNECT_INITIAL_DELAY_MS

      const hello = newEnvelope<typeof Topics.SYS_HELLO, HelloPayload>({
        kind: Kind.CMD,
        topic: Topics.SYS_HELLO,
        seq: outboundSeq,
        payload: {
          device_id: deviceId,
          token,
          protocol_version: ProtocolDefaults.PROTOCOL_VERSION,
          role: DeviceRole.SYNAPSE,
          client_wall_ms: Date.now(),
        },
      })

      ws.send(encode(hello))
    }

    ws.onmessage = (event: MessageEvent) => {
      const result = parse(String(event.data))
      if (!result.success) return

      const envelope = result.data

      if (envelope.topic === Topics.SYS_WELCOME) {
        const welcome = envelope.payload as WelcomePayload
        if (welcome.accepted) {
          statedRefusal = undefined
          publish({ status: 'connected', reason: undefined })
        } else {
          // A refused token is not a transport problem, so say so rather than retrying silently.
          statedRefusal = welcome.reason ?? 'Brain refused the connection.'
          publish({ status: 'offline', reason: statedRefusal })
          ws.close()
        }
        return
      }

      if (envelope.topic === Topics.CAP_MANIFEST) {
        const manifest = envelope.payload as CapabilityManifestPayload
        publish({
          // Merge rather than replace: the two halves may arrive in separate messages.
          capabilities: { ...snapshot.capabilities, ...manifest.capabilities },
          manifestAtMs: Date.now(),
        })
      }
    }

    ws.onerror = () => {
      // Errors are followed by a close; let that path own the reconnect so it runs once.
    }

    ws.onclose = () => {
      socket = undefined
      scheduleReconnect("Can't reach the Brain right now.")
    }
  }

  connect()

  return {
    stop(): void {
      stopped = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socket?.close()
      socket = undefined
    },
    snapshot(): LinkSnapshot {
      return snapshot
    },
  }
}
