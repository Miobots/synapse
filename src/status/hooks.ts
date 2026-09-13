import { useMemo, useRef } from 'react'
import { mergeRobotStatus } from './merge'
import type { LastKnownSnapshot, RobotStatusSources } from './types'

export function useRobotStatus(sources: RobotStatusSources) {
  const lastKnown = useRef<LastKnownSnapshot | null>(null)

  if (sources.heart.fresh && sources.heart.snapshot) {
    lastKnown.current = {
      snapshot: sources.heart.snapshot,
      seenAtMs: sources.heart.lastSeenAtMs,
    }
  }

  return useMemo(
    () =>
      mergeRobotStatus(
        sources.heart.fresh ? sources.heart.snapshot ?? null : null,
        lastKnown.current,
        sources,
      ),
    [sources.heart.fresh, sources.brain.fresh],
  )
}