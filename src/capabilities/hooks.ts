import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ProtocolDefaults, type PosePayload, type BatteryPayload } from '../protocol'
import { createBrainLink, UNSENT, type LinkSnapshot, type SendCommand } from '../link/client'
import { mergeCapabilities, type CapabilitySources } from './merge'
import type { OccupancyGrid } from '../map/types'

/**
 * A half is stale once it has missed three publish ticks — the same three-miss rule the heartbeat
 * watchdog uses (ENVELOPE.md §8), rather than a second invented threshold.
 */
export const HALF_STALE_AFTER_MS =
  ProtocolDefaults.CAP_MANIFEST_INTERVAL_MS * ProtocolDefaults.HEARTBEAT_MISSED_THRESHOLD

export function useCapabilities(sources: CapabilitySources) {
  const lastSeen = useRef<{ heart?: number; brain?: number }>({})

  // Written in an effect, never during render. Mutating a ref while rendering is torn up by
  // StrictMode's double invocation and by concurrent rendering.
  useEffect(() => {
    if (sources.heart.fresh && sources.heart.lastSeenAtMs !== undefined) {
      lastSeen.current.heart = sources.heart.lastSeenAtMs
    }
    if (sources.brain.fresh && sources.brain.lastSeenAtMs !== undefined) {
      lastSeen.current.brain = sources.brain.lastSeenAtMs
    }
  }, [
    sources.heart.fresh,
    sources.heart.lastSeenAtMs,
    sources.brain.fresh,
    sources.brain.lastSeenAtMs,
  ])

  return useMemo(
    () =>
      mergeCapabilities({
        heart: {
          fresh: sources.heart.fresh,
          lastSeenAtMs: sources.heart.fresh ? sources.heart.lastSeenAtMs : lastSeen.current.heart,
        },
        brain: {
          fresh: sources.brain.fresh,
          lastSeenAtMs: sources.brain.fresh ? sources.brain.lastSeenAtMs : lastSeen.current.brain,
        },
        capabilities: sources.capabilities,
      }),
    // lastSeenAtMs and the capabilities belong here. Leaving the timestamps out meant the
    // staleness banner kept showing whatever time it first rendered with.
    [
      sources.heart.fresh,
      sources.heart.lastSeenAtMs,
      sources.brain.fresh,
      sources.brain.lastSeenAtMs,
      sources.capabilities,
    ],
  )
}

/**
 * Splits one live link into the two halves S1.2 describes.
 *
 * Each half is fresh only while its own manifest keeps arriving over a live link. The Brain
 * publishes its half every tick and relays the robot's, but it cannot vouch for a robot that has
 * gone quiet — so a dead robot goes stale on its own clock while the Brain half stays live.
 */
/**
 * A live link, split into the two capability halves S1.2 describes, plus the robot's position.
 *
 * The pose rides the same link because it is the robot telling us where it is on the same wire that
 * tells us what it can do. It is telemetry, so it is last-received rather than accumulated: the
 * last one is kept, and `poseFresh` says whether it is still arriving.
 */
export interface LiveLink extends CapabilitySources {
  pose?: PosePayload
  poseAtMs?: number
  map?: OccupancyGrid
  mapAtMs?: number
  mapFresh: boolean
  battery?: BatteryPayload
  batteryAtMs?: number
  batteryFresh: boolean
  /**
   * Whether `pose` is still arriving. Judged on the pose's own clock, exactly like a manifest half:
   * the Brain being up says nothing about a robot that has gone quiet.
   */
  poseFresh: boolean
  /** The raw link status, for screens that need to know whether the wire is up at all. */
  status: LinkSnapshot['status']
  /** Ask the Brain to do something; resolves with how it ended. See {@link SendCommand}. */
  command: SendCommand
  /** Paired laptops; `online` is as of the Brain's last list, so trust it only while connected. */
  pairedDevices: LinkSnapshot['pairedDevices']
  /** The kill switch is on: Mio may not use any laptop. Trust it only while connected. */
  killswitchActive: boolean
  /** Requests waiting for a tap (S5.1). */
  approvals: LinkSnapshot['approvals']
  /** Answer one. False when it can no longer be answered (expired, or the link dropped). */
  answerApproval: (approvalId: string, approve: boolean) => boolean
}

export function useBrainLink(options?: { url?: string; token?: string }): LiveLink {
  const [snapshot, setSnapshot] = useState<LinkSnapshot>({
    status: 'connecting',
    capabilities: {},
    halfAtMs: {},
    approvals: [],
    pairedDevices: [],
  })
  const [now, setNow] = useState(() => Date.now())
  const linkRef = useRef<ReturnType<typeof createBrainLink> | null>(null)

  const url = options?.url
  const token = options?.token

  useEffect(() => {
    const link = createBrainLink({ url, token, onChange: setSnapshot })
    linkRef.current = link
    return () => {
      link.stop()
      linkRef.current = null
    }
  }, [url, token])

  // Stable across renders, so passing it to a memoised screen does not re-render it every tick.
  const command = useCallback<SendCommand>(
    (topic, payload) => linkRef.current?.command(topic, payload) ?? Promise.resolve(UNSENT),
    [],
  )

  const answerApproval = useCallback(
    (approvalId: string, approve: boolean) => linkRef.current?.answerApproval(approvalId, approve) ?? false,
    [],
  )

  // Staleness is the passage of time, not an event, so it needs its own tick to be noticed.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ProtocolDefaults.CAP_MANIFEST_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  return useMemo(() => {
    const connected = snapshot.status === 'connected'
    const isFresh = (atMs?: number) =>
      connected && atMs !== undefined && now - atMs < HALF_STALE_AFTER_MS

    return {
      heart: { fresh: isFresh(snapshot.halfAtMs.heart), lastSeenAtMs: snapshot.halfAtMs.heart },
      brain: { fresh: isFresh(snapshot.halfAtMs.brain), lastSeenAtMs: snapshot.halfAtMs.brain },
      capabilities: snapshot.capabilities,
      pose: snapshot.pose,
      poseAtMs: snapshot.poseAtMs,
      map: snapshot.map,
      mapAtMs: snapshot.mapAtMs,
      mapFresh: isFresh(snapshot.mapAtMs),
      battery: snapshot.battery,
      batteryAtMs: snapshot.batteryAtMs,
      batteryFresh: isFresh(snapshot.batteryAtMs),
      // ponytail: the pose shares the manifest's 30 s window, so "the robot went quiet" is one
      // clock. Give it a tighter window of its own once something publishes `state.pose` and its
      // real rate is known.
      poseFresh: isFresh(snapshot.poseAtMs),
      status: snapshot.status,
      command,
      approvals: snapshot.approvals,
      pairedDevices: snapshot.pairedDevices,
      killswitchActive: snapshot.killswitchActive === true,
      answerApproval,
    }
  }, [snapshot, now, command, answerApproval])
}
