import type { PosePayload } from '../protocol/index.ts'
import { Cell, type OccupancyGrid } from './types.ts'
import { createGrid, setCell } from './grid.ts'

/**
 * A stand-in for the robot's map, until the wire topic exists (see `types.ts`).
 *
 * It is a deterministic room — walls, a couple of interior partitions with doorways, a few
 * obstacles — surrounded by unexplored cells, so the screen shows all three states and the grid is
 * big enough to be worth drawing. No randomness: the same size always produces the same map, which
 * is what lets the test assert on it.
 */

export const DEFAULT_GRID_SIZE = 128
export const DEFAULT_RESOLUTION = 0.05

export function fixtureGrid(
  size: number = DEFAULT_GRID_SIZE,
  resolution: number = DEFAULT_RESOLUTION,
): OccupancyGrid {
  const grid = createGrid(size, size, resolution, Cell.Unknown)

  const margin = Math.max(2, Math.round(size * 0.06))
  const x0 = margin
  const y0 = margin
  const x1 = size - margin
  const y1 = size - margin

  // Explored floor.
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) setCell(grid, x, y, Cell.Free)
  }

  // Outer wall of the explored region.
  for (let x = x0; x < x1; x++) {
    setCell(grid, x, y0, Cell.Occupied)
    setCell(grid, x, y1 - 1, Cell.Occupied)
  }
  for (let y = y0; y < y1; y++) {
    setCell(grid, x0, y, Cell.Occupied)
    setCell(grid, x1 - 1, y, Cell.Occupied)
  }

  // A vertical partition a third of the way across, with a doorway gap in the middle.
  const vx = Math.round(x0 + (x1 - x0) / 3)
  const doorGap = Math.max(2, Math.round((y1 - y0) * 0.16))
  const doorMid = Math.round((y0 + y1) / 2)
  for (let y = y0 + 1; y < y1 - 1; y++) {
    if (Math.abs(y - doorMid) <= doorGap) continue
    setCell(grid, vx, y, Cell.Occupied)
  }

  // A horizontal partition two thirds down, with a doorway near the left wall.
  const hy = Math.round(y0 + ((y1 - y0) * 2) / 3)
  const hDoor = x0 + Math.round((x1 - x0) * 0.2)
  for (let x = x0 + 1; x < x1 - 1; x++) {
    if (Math.abs(x - hDoor) <= doorGap) continue
    setCell(grid, x, hy, Cell.Occupied)
  }

  // Furniture: a few blocks to break up the free space.
  const blocks = Math.max(1, Math.round(size / 32))
  for (const [bx, by] of [
    [x0 + Math.round((x1 - x0) * 0.15), y0 + Math.round((y1 - y0) * 0.15)],
    [x0 + Math.round((x1 - x0) * 0.42), y0 + Math.round((y1 - y0) * 0.28)],
    [x0 + Math.round((x1 - x0) * 0.72), y0 + Math.round((y1 - y0) * 0.78)],
  ]) {
    for (let dy = 0; dy < blocks; dy++) {
      for (let dx = 0; dx < blocks; dx++) setCell(grid, bx + dx, by + dy, Cell.Occupied)
    }
  }

  return grid
}

/**
 * The robot's pose at time `t`, in metres, following a slow loop around the explored area.
 *
 * Mapped through the same `resolution` as the grid, so placing it is a division — and the heading
 * is the tangent of the path, so the marker visibly turns as it goes round. Five times a second is
 * the rate S2.1's exit check calls for; the caller decides how often to sample it.
 */
export function fixturePose(
  size: number,
  resolution: number,
  tMs: number,
  periodMs = 8_000,
): PosePayload {
  const radius = size * 0.3
  const angle = (2 * Math.PI * tMs) / periodMs
  const col = size / 2 + radius * Math.cos(angle)
  const row = size / 2 + radius * Math.sin(angle)

  return {
    // The view puts row 0 at the top, so a larger row is a lower `y` in metres.
    x: col * resolution,
    y: (size - row) * resolution,
    yaw: angle + Math.PI / 2,
    confidence: 0.9,
  }
}
