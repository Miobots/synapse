import type { SystemHealth } from '@miobots/protocol'

export interface RobotStatusSnapshot {
  batteryPct: number
  room: string
  activity: string
  health: SystemHealth
}

export interface StatusSource {
  fresh: boolean
  snapshot?: RobotStatusSnapshot
  lastSeenAtMs?: number
}

export interface RobotStatusSources {
  heart: StatusSource
  brain: StatusSource
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