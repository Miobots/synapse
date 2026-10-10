import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { buildOccupancyPath, cellAt, countCells, createGrid, setCell } from './grid.ts'
import { fixtureGrid, fixturePose } from './fixture.ts'
import { Cell } from './types.ts'

/**
 * S2.1 is a *drawing* decision, measured on a device. What is checked here is the geometry the
 * drawing is built from — the part that must be right before any of the measuring means anything.
 *
 * The load-bearing one is the run merge: it is the reason a full-size grid is one path node instead
 * of tens of thousands of rects, so the test pins the exact `d` it produces.
 */

describe('createGrid', () => {
  it('allocates width*height cells, defaulting to unknown', () => {
    const grid = createGrid(4, 3, 0.05)
    assert.equal(grid.width, 4)
    assert.equal(grid.height, 3)
    assert.equal(grid.resolution, 0.05)
    assert.equal(grid.cells.length, 12)
    assert.ok(grid.cells.every((c) => c === Cell.Unknown))
  })

  it('fills a non-unknown grid', () => {
    const grid = createGrid(2, 2, 0.1, Cell.Free)
    assert.ok(grid.cells.every((c) => c === Cell.Free))
  })

  it('refuses a degenerate grid', () => {
    assert.throws(() => createGrid(0, 5, 0.1))
  })
})

describe('cell access', () => {
  it('round-trips a written cell', () => {
    const grid = createGrid(3, 3, 0.1)
    setCell(grid, 1, 2, Cell.Occupied)
    assert.equal(cellAt(grid, 1, 2), Cell.Occupied)
    assert.equal(cellAt(grid, 2, 2), Cell.Unknown)
  })

  it('reads outside the grid as unknown rather than throwing', () => {
    const grid = createGrid(3, 3, 0.1)
    assert.equal(cellAt(grid, -1, 0), Cell.Unknown)
    assert.equal(cellAt(grid, 0, 3), Cell.Unknown)
  })
})

describe('buildOccupancyPath', () => {
  it('merges a row of same-state cells into one run', () => {
    const grid = createGrid(4, 1, 0.1)
    setCell(grid, 0, 0, Cell.Free)
    setCell(grid, 1, 0, Cell.Free)
    setCell(grid, 2, 0, Cell.Occupied)
    setCell(grid, 3, 0, Cell.Occupied)

    assert.equal(buildOccupancyPath(grid, Cell.Free), 'M0 0h2v1h-2z')
    assert.equal(buildOccupancyPath(grid, Cell.Occupied), 'M2 0h2v1h-2z')
  })

  it('does not merge across a row boundary, or across a gap', () => {
    const grid = createGrid(2, 2, 0.1)
    // row 0: free, occupied ; row 1: free, free
    setCell(grid, 0, 0, Cell.Free)
    setCell(grid, 1, 0, Cell.Occupied)
    setCell(grid, 0, 1, Cell.Free)
    setCell(grid, 1, 1, Cell.Free)

    assert.equal(buildOccupancyPath(grid, Cell.Free), 'M0 0h1v1h-1zM0 1h2v1h-2z')
    assert.equal(buildOccupancyPath(grid, Cell.Occupied), 'M1 0h1v1h-1z')
  })

  it('draws nothing for a state that is not present', () => {
    const grid = createGrid(3, 3, 0.1, Cell.Free)
    assert.equal(buildOccupancyPath(grid, Cell.Occupied), '')
  })
})

describe('countCells', () => {
  it('counts each state', () => {
    const grid = createGrid(2, 2, 0.1)
    setCell(grid, 0, 0, Cell.Free)
    setCell(grid, 1, 1, Cell.Occupied)
    assert.deepEqual(countCells(grid), { free: 1, occupied: 1, unknown: 2 })
  })
})

describe('fixture', () => {
  it('produces a map with all three cell states', () => {
    const grid = fixtureGrid(48)
    const counts = countCells(grid)
    assert.ok(counts.free > 0, 'some floor')
    assert.ok(counts.occupied > 0, 'some walls')
    assert.ok(counts.unknown > 0, 'some unexplored cells')
  })

  it('puts the robot somewhere on the map, and it moves', () => {
    const size = 64
    const resolution = 0.05
    const a = fixturePose(size, resolution, 0)
    const b = fixturePose(size, resolution, 2_000)

    assert.notEqual(a.x, b.x)
    for (const p of [a, b]) {
      assert.ok(p.x >= 0 && p.x <= size * resolution)
      assert.ok(p.y >= 0 && p.y <= size * resolution)
    }
  })
})
