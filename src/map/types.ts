import type { PosePayload } from '../protocol/index.ts'

/**
 * M-82 / S2.1 — the occupancy grid.
 *
 * The robot owns this map; the app only draws what it is handed and keeps the last copy. There is
 * **no map topic in `@miobots/protocol` yet** (only `state.pose` / `state.battery` telemetry), so
 * the grid shape below is a local placeholder for this task. When the wire topic lands it moves to
 * the protocol package and is imported from `../protocol` like every other message shape —
 * retyping it here is exactly what CLAUDE.md warns against, so this file is a staging area, not a
 * second source of truth.
 *
 * The pose, by contrast, is already a real message shape and is imported above rather than redrawn.
 */

/** Row-major cell state. `Unknown` is the default: a cell nobody has looked at yet. */
export const Cell = {
  Unknown: 0,
  Free: 1,
  Occupied: 2,
} as const

export type CellValue = (typeof Cell)[keyof typeof Cell]

export interface OccupancyGrid {
  width: number
  height: number
  /** Metres per cell, so a pose in metres can be placed onto the grid. */
  resolution: number
  /** Row-major, length `width * height`. */
  cells: Uint8Array
}

export interface MapSnapshot {
  grid: OccupancyGrid
  /** The robot's pose in metres, from `state.pose`. Absent until one arrives. */
  pose?: PosePayload
}

export interface MapSource {
  fresh: boolean
  snapshot?: MapSnapshot
  lastSeenAtMs?: number
}

/** What the screen renders: the live map, or the last one we saw, plus how fresh it is. */
export interface MergedMap {
  grid?: OccupancyGrid
  pose?: PosePayload
  fresh: boolean
  lastSeenAtMs?: number
}
