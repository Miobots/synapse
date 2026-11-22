import type { SystemHealth } from '../protocol/index.ts'

export interface RobotStatusSnapshot {
  batteryPct?: number
  isCharging?: boolean
  room?: string
  activity?: string
  health?: SystemHealth
}

export interface StatusSource {
  fresh: boolean
  snapshot?: RobotStatusSnapshot
  snapshotFresh?: boolean
  lastSeenAtMs?: number
}

export interface RobotStatusSources {
  heart: StatusSource
  brain: StatusSource
  /**
   * The paired laptops, if any. No laptop paired means no Laptop link at all: Ganglion is optional,
   * and a permanent red chip would read as a fault (vault CLAUDE.md, "deliberately removable").
   */
  laptops?: { paired: number; online: number }
}

export interface LastKnownSnapshot {
  snapshot: RobotStatusSnapshot
  seenAtMs?: number
}

export type StatusTone = 'ok' | 'warn' | 'danger'

export interface StatusTileItem {
  id: string
  label: string
  value: string
  fresh: boolean
  lastSeenAtMs?: number
  tone?: StatusTone
}

export interface LinkItem {
  id: string
  label: string
  up: boolean
}

export interface MergedRobotStatus {
  tiles: StatusTileItem[]
  links: LinkItem[]
  allCached: boolean
  lastSeenAtMs?: number
}
