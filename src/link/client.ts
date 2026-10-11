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
  SystemHealth,
  SequenceCounter,
  newEnvelope,
  encode,
  parse,
  type AckPayload,
  type CapabilityManifestPayload,
  type CapabilityStatus,
  type HeartbeatPayload,
  type HelloPayload,
  type PayloadFor,
  type PosePayload,
  type TopicName,
  type WelcomePayload,
} from '../protocol/index.ts'
import { halfOf } from '../capabilities/catalog.ts'

export type LinkStatus = 'connecting' | 'connected' | 'offline'

/**
 * Asks the Brain to do something, on the current connection.
 *
 * Commands are requests, never decisions (CLAUDE.md): the app names what it wants and the Brain
 * decides. So the answer is the Brain's `ACK`, not the fact that we wrote to a socket — the promise
 * resolves only once the Brain has accepted, refused, or failed to answer (ENVELOPE.md §3). It never
 * rejects: every ending is something to tell the user, not an exception.
 */
export type SendCommand = <TTopic extends TopicName>(
  topic: TTopic,
  payload: PayloadFor<TTopic, unknown>,
) => Promise<CommandOutcome>

/** How a command ended. Only `accepted` means the Brain took it — and even that is not "finished". */
export type CommandOutcome =
  | { status: 'accepted' }
  /** The Brain, or the robot behind it, said no. `reason` is the publisher's own word for why. */
  | { status: 'rejected'; reason?: string }
  /** Nobody answered: the wire was down, dropped, or the ACK never came. `reason` is plain words. */
  | { status: 'failed'; reason: string }

const UNREACHABLE = "Can't reach the Brain right now."

/** What a command gets when there is no connection to send it on. */
export const UNSENT: CommandOutcome = { status: 'failed', reason: UNREACHABLE }

export interface LinkSnapshot {
  status: LinkStatus
  /** Capabilities as last published, keyed by capability id. Empty until a manifest arrives. */
  capabilities: Record<string, CapabilityStatus>
  /**
   * When each half last arrived. Kept per half because the Brain publishes its own half every tick:
   * one shared timestamp would keep a dead robot looking fresh for as long as the Brain is up.
   */
  halfAtMs: { heart?: number; brain?: number }
  /**
   * Latest `state.pose` telemetry, and when it arrived. It is kept when the link goes down, like the
   * capabilities, so the map can still draw the last known position — which is exactly why it must
   * never be shown as live without checking `poseAtMs` against the clock (`useBrainLink` does, as
   * `poseFresh`).
   */
  pose?: PosePayload
  poseAtMs?: number
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

  /**
   * ENVELOPE.md §8: heartbeats flow both ways every 5 s, and three missed beats mean the link is
   * dead. The Brain closes any connection that stays silent for 15 s, so without our beat the app
   * was dropped and re-connected every 15 s. Their beat matters just as much: a pulled router does
   * not close the socket, it just goes quiet, and only the missing beats notice.
   */
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined
  let lastInboundMs = 0

  function stopHeartbeat(): void {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = undefined
  }

  function startHeartbeat(ws: WebSocket): void {
    stopHeartbeat()
    lastInboundMs = Date.now()
    heartbeatTimer = setInterval(() => {
      if (Date.now() - lastInboundMs >= ProtocolDefaults.HEARTBEAT_TIMEOUT_MS) {
        // Don't wait for onclose: on a dead network the close handshake can itself hang.
        stopHeartbeat()
        ws.onclose = null
        ws.close()
        socket = undefined
        scheduleReconnect(UNREACHABLE)
        return
      }
      ws.send(
        encode(
          newEnvelope<typeof Topics.SYS_HEARTBEAT, HeartbeatPayload>({
            kind: Kind.EVT,
            topic: Topics.SYS_HEARTBEAT,
            seq: outboundSeq,
            payload: { status: SystemHealth.OK, t_wall_ms: Date.now() },
          }),
        ),
      )
    }, ProtocolDefaults.HEARTBEAT_INTERVAL_MS)
  }

  let snapshot: LinkSnapshot = { status: 'connecting', capabilities: {}, halfAtMs: {} }

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

  /** Commands still waiting for their `ACK`, by `corr_id` (ENVELOPE.md §3). */
  const pending = new Map<
    string,
    { resolve: (outcome: CommandOutcome) => void; timer: ReturnType<typeof setTimeout> }
  >()

  function settle(corrId: string, outcome: CommandOutcome): void {
    const waiting = pending.get(corrId)
    if (!waiting) return
    clearTimeout(waiting.timer)
    pending.delete(corrId)
    waiting.resolve(outcome)
  }

  /** A command whose connection died is told so now, not left to time out on a dead wire. */
  function failPending(): void {
    for (const corrId of [...pending.keys()]) settle(corrId, UNSENT)
  }

  function scheduleReconnect(reason: string): void {
    failPending()
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
      lastInboundMs = Date.now()

      if (envelope.topic === Topics.SYS_WELCOME) {
        const welcome = envelope.payload as WelcomePayload
        if (welcome.accepted) {
          statedRefusal = undefined
          startHeartbeat(ws)
          publish({ status: 'connected', reason: undefined })
        } else {
          // A refused token is not a transport problem, so say so rather than retrying silently.
          statedRefusal = welcome.reason ?? 'Brain refused the connection.'
          publish({ status: 'offline', reason: statedRefusal })
          ws.close()
        }
        return
      }

      if (envelope.kind === Kind.ACK) {
        const ack = envelope.payload as AckPayload
        settle(
          envelope.corr_id,
          ack.accepted ? { status: 'accepted' } : { status: 'rejected', reason: ack.reason },
        )
        return
      }

      if (envelope.topic === Topics.CAP_MANIFEST) {
        const manifest = envelope.payload as CapabilityManifestPayload
        const now = Date.now()
        const halfAtMs = { ...snapshot.halfAtMs }
        for (const id of Object.keys(manifest.capabilities)) halfAtMs[halfOf(id)] = now
        publish({
          // Merge rather than replace: the two halves may arrive in separate messages.
          capabilities: { ...snapshot.capabilities, ...manifest.capabilities },
          halfAtMs,
        })
        return
      }

      if (envelope.topic === Topics.STATE_POSE) {
        publish({ pose: envelope.payload as PosePayload, poseAtMs: Date.now() })
      }
    }

    ws.onerror = () => {
      // Errors are followed by a close; let that path own the reconnect so it runs once.
    }

    ws.onclose = () => {
      stopHeartbeat()
      socket = undefined
      scheduleReconnect(UNREACHABLE)
    }
  }

  connect()

  return {
    stop(): void {
      stopped = true
      stopHeartbeat()
      failPending()
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socket?.close()
      socket = undefined
    },
    snapshot(): LinkSnapshot {
      return snapshot
    },
    command<TTopic extends TopicName>(
      topic: TTopic,
      payload: PayloadFor<TTopic, unknown>,
    ): Promise<CommandOutcome> {
      const ws = socket
      if (stopped || !ws || snapshot.status !== 'connected') return Promise.resolve(UNSENT)
      // Share the connection's outbound sequence counter with the heartbeat, exactly as ENVELOPE §6
      // requires: one counter per connection, not one per topic.
      const envelope = newEnvelope<TTopic, unknown>({ kind: Kind.CMD, topic, seq: outboundSeq, payload })
      ws.send(encode(envelope))

      // ponytail: one attempt. ENVELOPE §3 allows three retries on the same `idem_key`; add them
      // here once a lost ACK is actually seen — until then a second tap is the retry.
      return new Promise((resolve) => {
        const timer = setTimeout(
          () => settle(envelope.corr_id, { status: 'failed', reason: "The Brain didn't answer." }),
          ProtocolDefaults.DEFAULT_COMMAND_TIMEOUT_MS,
        )
        pending.set(envelope.corr_id, { resolve, timer })
      })
    },
  }
}
