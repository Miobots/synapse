import { Cell, type CellValue, type OccupancyGrid } from './types.ts'

/**
 * Pure grid maths for S2.1. Kept free of React (and of JSX) so `npm test` covers it — the render
 * is what we *measure* on a device, the geometry is what we *verify*.
 */

export function createGrid(
  width: number,
  height: number,
  resolution: number,
  fill: CellValue = Cell.Unknown,
  origin: OccupancyGrid['origin'] = { x: 0, y: 0 },
): OccupancyGrid {
  if (width <= 0 || height <= 0) throw new Error('grid must be at least 1x1 cell')
  const cells = new Uint8Array(width * height)
  if (fill !== Cell.Unknown) cells.fill(fill)
  return { width, height, resolution, origin, cells }
}

export function inBounds(grid: OccupancyGrid, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < grid.width && row < grid.height
}

export function indexOf(grid: OccupancyGrid, col: number, row: number): number {
  return row * grid.width + col
}

export function cellAt(grid: OccupancyGrid, col: number, row: number): CellValue {
  return inBounds(grid, col, row) ? (grid.cells[indexOf(grid, col, row)] as CellValue) : Cell.Unknown
}

export function setCell(grid: OccupancyGrid, col: number, row: number, value: CellValue): void {
  if (inBounds(grid, col, row)) grid.cells[indexOf(grid, col, row)] = value
}

/**
 * One SVG path `d` covering every cell of `state`, with consecutive cells in a row merged into a
 * single run.
 *
 * This is the whole reason S2.1 is a decision rather than a `<Rect>` in a loop: a full-size grid is
 * tens of thousands of cells, and per-cell nodes make the reconciler the bottleneck long before the
 * GPU is. Merging runs turns a 256×256 room (65 536 cells) into a few thousand subpaths, and the
 * grid is redrawn off one path node instead of thousands.
 *
 * Coordinates are in grid cells; the SVG `viewBox` does the scaling.
 */
export function buildOccupancyPath(grid: OccupancyGrid, state: CellValue): string {
  const { width, height, cells } = grid
  let d = ''

  for (let row = 0; row < height; row++) {
    let col = 0
    while (col < width) {
      if (cells[row * width + col] !== state) {
        col++
        continue
      }
      const start = col
      while (col < width && cells[row * width + col] === state) col++
      const run = col - start
      d += `M${start} ${row}h${run}v1h-${run}z`
    }
  }

  return d
}

export function countCells(grid: OccupancyGrid): {
  free: number
  occupied: number
  unknown: number
} {
  let free = 0
  let occupied = 0
  let unknown = 0
  for (let i = 0; i < grid.cells.length; i++) {
    const v = grid.cells[i]
    if (v === Cell.Free) free++
    else if (v === Cell.Occupied) occupied++
    else unknown++
  }
  return { free, occupied, unknown }
}
