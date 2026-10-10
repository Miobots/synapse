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
    col: pose.x / grid.resolution,
    row: grid.height - pose.y / grid.resolution,
    degrees: (-pose.yaw * 180) / Math.PI,
  }
}
