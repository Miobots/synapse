import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { placePose, worldFromCell, cellFromViewPoint } from './pose.ts'
import { createGrid } from './grid.ts'
import type { PosePayload } from '../protocol/index.ts'

// 5 m wide, 2.5 m tall, 5 cm cells.
const grid = createGrid(100, 50, 0.05)

function pose(x: number, y: number, yaw: number): PosePayload {
  return { x, y, yaw, confidence: 1 }
}

describe('placePose', () => {
  it('scales metres into cells', () => {
    const at = placePose(grid, pose(1, 1, 0))
    assert.equal(at.col, 20)
    assert.equal(at.row, 30)
  })

  it('measures from the map origin, not from world zero', () => {
    // Heart's `home_arena` map: 5 cm cells, bottom-left corner at (-3.952, -2.949).
    const arena = createGrid(160, 120, 0.05, undefined, { x: -3.952, y: -2.949 })
    const at = placePose(arena, pose(0, 0, 0))
    assert.ok(Math.abs(at.col - 79.04) < 1e-9)
    assert.ok(Math.abs(at.row - (120 - 58.98)) < 1e-9)
  })

  it('flips the row, because the canvas grows downward and the robot does not', () => {
    const near = placePose(grid, pose(0, 0.1, 0))
    const far = placePose(grid, pose(0, 2.4, 0))
    assert.ok(far.row < near.row, 'a larger y must be higher up, i.e. a smaller row')
  })

  it('points yaw 0 along +x (right) — 0 SVG degrees', () => {
    // `-yaw` yields -0 for yaw 0; +0 to normalise so the assertion is about the angle, not the sign.
    assert.equal(placePose(grid, pose(0, 0, 0)).degrees + 0, 0)
  })

  it('points +90° yaw up the screen, which is -90 SVG degrees on a y-down canvas', () => {
    assert.equal(placePose(grid, pose(0, 0, Math.PI / 2)).degrees, -90)
  })

  it('points 180° yaw the opposite way', () => {
    assert.equal(placePose(grid, pose(0, 0, Math.PI)).degrees, -180)
  })
})

describe('worldFromCell', () => {
  it('is the inverse of placePose', () => {
    const at = placePose(grid, pose(1.2, 0.8, 0))
    const back = worldFromCell(grid, at.col, at.row)
    assert.ok(Math.abs(back.x - 1.2) < 1e-9)
    assert.ok(Math.abs(back.y - 0.8) < 1e-9)
  })

  it('stays the inverse on a map that does not start at world zero', () => {
    // A goal read off the real map has to come back in the robot's frame, not the grid's.
    const arena = createGrid(160, 120, 0.05, undefined, { x: -3.952, y: -2.949 })
    const at = placePose(arena, pose(1.2, -0.8, 0))
    const back = worldFromCell(arena, at.col, at.row)
    assert.ok(Math.abs(back.x - 1.2) < 1e-9)
    assert.ok(Math.abs(back.y + 0.8) < 1e-9)
  })
})

describe('cellFromViewPoint', () => {
  it('maps the centre of a same-aspect view to the centre of the grid', () => {
    // View 500x250 and grid 100x50 are both 2:1, so there is no letterboxing.
    const cell = cellFromViewPoint(grid, { width: 500, height: 250 }, { x: 250, y: 125 })
    assert.equal(cell.col, 50)
    assert.equal(cell.row, 25)
  })

  it('undoes the left/right letterbox when the view is wider than the map', () => {
    // View 600x250 vs grid 100x50: scale = min(6, 5) = 5, drawn 500 wide, centred with 50 px bars.
    const view = { width: 600, height: 250 }
    assert.equal(cellFromViewPoint(grid, view, { x: 50, y: 0 }).col, 0)
    assert.equal(cellFromViewPoint(grid, view, { x: 550, y: 0 }).col, 100)
    // A tap in the left bar lands off the map, before column 0.
    assert.ok(cellFromViewPoint(grid, view, { x: 10, y: 0 }).col < 0)
  })

  it('undoes the top/bottom letterbox when the view is taller than the map', () => {
    // View 100x100 vs grid 100x50: scale = min(1, 2) = 1, drawn 50 tall, centred with 25 px bars.
    const view = { width: 100, height: 100 }
    assert.equal(cellFromViewPoint(grid, view, { x: 0, y: 25 }).row, 0)
    assert.equal(cellFromViewPoint(grid, view, { x: 0, y: 75 }).row, 50)
  })
})
