import { useMemo, useRef } from 'react'
import { mergeRobotStatus } from './merge'
import type { LastKnownSnapshot, RobotStatusSources } from './types'

export function useRobotStatus(sources: RobotStatusSources) {
  const lastKnown = useRef<LastKnownSnapshot | null>(
    sources.heart.snapshot
      ? { snapshot: sources.heart.snapshot, seenAtMs: sources.heart.lastSeenAtMs }
      : null,
  )

  const snapshotFresh = sources.heart.snapshotFresh ?? sources.heart.fresh

  if (snapshotFresh && sources.heart.snapshot) {
    lastKnown.current = {
      snapshot: sources.heart.snapshot,
      seenAtMs: sources.heart.lastSeenAtMs,
    }
  }

  return useMemo(
    () =>
      mergeRobotStatus(
        snapshotFresh ? sources.heart.snapshot ?? null : null,
        lastKnown.current,
        sources,
      ),
    [
      sources.heart.fresh,
      sources.heart.snapshotFresh,
      sources.heart.snapshot,
      sources.heart.lastSeenAtMs,
      sources.brain.fresh,
      sources.brain.lastSeenAtMs,
    ],
  )
}
