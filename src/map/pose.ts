import type { PosePayload } from '../protocol/index.ts'
import type { OccupancyGrid } from './types.ts'

export interface PoseLocation {
  /** Column on the grid (x grows left → right). */
  col: number
  /** Row on the grid (0 at the top; the robot's y grows up, this grows down). */
  row: number
  /** Heading in SVG degrees (clockwise, because a canvas is y-down). */
  degrees: number
}

/**
 * S2.2 — where on the grid the robot is, and which way it points.
 *
 * The robot's pose is metres in a y-up frame; the grid is cells in a y-down canvas. Flipping the row
 * and negating the heading are the two conversions that, done wrong, draw the robot in the right
 * place pointing backwards — which reads as a broken robot even when the robot is fine. So both live
 * here and are pinned by a test rather than eyeballed in a marker.
 */
export function placePose(grid: OccupancyGrid, pose: PosePayload): PoseLocation {
  return {
    col: (pose.x - grid.origin.x) / grid.resolution,
    row: grid.height - (pose.y - grid.origin.y) / grid.resolution,
    degrees: (-pose.yaw * 180) / Math.PI,
  }
}

/**
 * S2.3 — the world point (metres) at a cell's top-left corner. The exact inverse of `placePose`'s
 * position, so a cell we read off the screen and a pose we place onto it agree by construction.
 */
export function worldFromCell(grid: OccupancyGrid, col: number, row: number): { x: number; y: number } {
  return { x: col * grid.resolution, y: (grid.height - row) * grid.resolution }
}

export interface ViewSize {
  width: number
  height: number
}

/**
 * Where a tap landed, in grid cells.
 *
 * The map is drawn with `preserveAspectRatio="xMidYMid meet"`: the grid is scaled by the smaller of
 * the two ratios and centred, so the leftover space is letterboxing, not map. Tap coordinates arrive
 * in view pixels, so this has to undo that same fit — get it wrong and every goal lands a few cells
 * off, which is exactly the "tapped there, robot went there" bug S2.3 is about. Kept pure, next to
 * the forward transform, so a test pins it instead of a finger.
 */
export function cellFromViewPoint(
  grid: OccupancyGrid,
  view: ViewSize,
  point: { x: number; y: number },
): { col: number; row: number } {
  const scale = Math.min(view.width / grid.width, view.height / grid.height)
  const offsetX = (view.width - grid.width * scale) / 2
  const offsetY = (view.height - grid.height * scale) / 2
  return { col: (point.x - offsetX) / scale, row: (point.y - offsetY) / scale }
}
