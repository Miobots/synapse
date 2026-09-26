import type { SystemHealth } from '@miobots/protocol'
import type {
  LastKnownSnapshot,
  LinkItem,
  MergedRobotStatus,
  RobotStatusSnapshot,
  RobotStatusSources,
  StatusTileItem,
  StatusTone,
} from './types'

const HEALTH_LABEL: Record<SystemHealth, string> = {
  ok: 'OK',
  degraded: 'Degraded',
  fault: 'Fault',
}

const HEALTH_TONE: Record<SystemHealth, StatusTone> = {
  ok: 'ok',
  degraded: 'warn',
  fault: 'danger',
}

export function mergeRobotStatus(
  current: RobotStatusSnapshot | null,
  lastKnown: LastKnownSnapshot | null,
  sources: RobotStatusSources,
): MergedRobotStatus {
  const fresh = current !== null
  const source = current ?? lastKnown?.snapshot ?? null
  const lastSeenAtMs = fresh ? sources.heart.lastSeenAtMs : lastKnown?.seenAtMs

  const tile = (
    id: string,
    label: string,
    value: string,
    tone?: StatusTone,
  ): StatusTileItem => ({
    id,
    label,
    value,
    fresh,
    lastSeenAtMs,
    tone,
  })

  const tiles: StatusTileItem[] = [
    tile('battery', 'Battery', source ? `${source.batteryPct}%` : 'Unknown'),
    tile('room', 'Room', source?.room ?? 'Unknown'),
    tile('activity', 'Doing', source?.activity ?? 'Unknown'),
    tile('health', 'Health', source ? HEALTH_LABEL[source.health] : 'Unknown', source ? HEALTH_TONE[source.health] : undefined),
  ]

  const links: LinkItem[] = [
    { id: 'robot', label: 'Robot', up: sources.heart.fresh },
    { id: 'brain', label: 'Brain', up: sources.brain.fresh },
    { id: 'core', label: 'Robot↔Brain', up: sources.heart.fresh && sources.brain.fresh },
  ]

  const overallSeen = Math.max(sources.heart.lastSeenAtMs ?? 0, sources.brain.lastSeenAtMs ?? 0)

  return {
    tiles,
    links,
    allCached: !sources.heart.fresh && !sources.brain.fresh,
    lastSeenAtMs: overallSeen > 0 ? overallSeen : undefined,
  }
}