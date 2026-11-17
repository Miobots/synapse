import type { PosePayload } from '../protocol/index.ts'

/**
 * M-82 / S2.1 — the occupancy grid.
 *
 * The robot owns this map; the app only draws what it is handed and keeps the last copy. There is
 * The wire shape is `MapSnapshotPayload` in the shared protocol. This is the decoded renderer
 * shape: a Uint8Array instead of run-length encoded cells.
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
  /**
   * World position, in metres, of the grid's bottom-left corner — the `origin` of a ROS map. A real
   * map rarely starts at (0, 0): Heart's `home_arena` starts at (-3.952, -2.949), and ignoring that
   * draws the robot about four metres from where it is.
   */
  origin: { x: number; y: number }
  /** Row-major, length `width * height`. Row 0 is the top of the map — the largest `y`. */
  cells: Uint8Array
}

export interface MapSnapshot {
  /** Absent until a map arrives; a pose can be known before the grid is. */
  grid?: OccupancyGrid
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
