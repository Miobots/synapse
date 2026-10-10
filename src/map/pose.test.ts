import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { placePose } from './pose.ts'
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
