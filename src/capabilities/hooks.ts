import { useEffect, useMemo, useRef, useState } from 'react'
import { ProtocolDefaults } from '../protocol'
import { createBrainLink, type LinkSnapshot } from '../link/client'
import { mergeCapabilities, type CapabilitySources } from './merge'

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
export function useBrainLink(options?: { url?: string; token?: string }): CapabilitySources {
  const [snapshot, setSnapshot] = useState<LinkSnapshot>({
    status: 'connecting',
    capabilities: {},
    halfAtMs: {},
  })
  const [now, setNow] = useState(() => Date.now())

  const url = options?.url
  const token = options?.token

  useEffect(() => {
    const link = createBrainLink({ url, token, onChange: setSnapshot })
    return () => link.stop()
  }, [url, token])

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
    }
  }, [snapshot, now])
}
