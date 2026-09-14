import { useMemo, useRef } from 'react'
import { CAPABILITY_CATALOG } from './catalog'
import { mergeCapabilities, type CapabilitySources } from './merge'

export function useCapabilities(sources: CapabilitySources) {
  const lastSeen = useRef<{ heart?: number; brain?: number }>({})

  if (sources.heart.fresh && sources.heart.lastSeenAtMs !== undefined) {
    lastSeen.current.heart = sources.heart.lastSeenAtMs
  }
  if (sources.brain.fresh && sources.brain.lastSeenAtMs !== undefined) {
    lastSeen.current.brain = sources.brain.lastSeenAtMs
  }

  return useMemo(
    () =>
      mergeCapabilities(CAPABILITY_CATALOG, {
        heart: {
          fresh: sources.heart.fresh,
          lastSeenAtMs: sources.heart.fresh ? sources.heart.lastSeenAtMs : lastSeen.current.heart,
        },
        brain: {
          fresh: sources.brain.fresh,
          lastSeenAtMs: sources.brain.fresh ? sources.brain.lastSeenAtMs : lastSeen.current.brain,
        },
      }),
    [sources.heart.fresh, sources.brain.fresh],
  )
}