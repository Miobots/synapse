import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { mergeRobotStatus } from './merge.ts'
import type { RobotStatusSnapshot, RobotStatusSources } from './types.ts'

/**
 * S1.3's exit check is "cached state is visibly cached".
 *
 * CLAUDE.md puts it more sharply: "Presenting stale data as live is the one way a read-only app
 * can still lie." So every tile carries its own `fresh` flag and the time it was seen — a value
 * on its own is not enough.
 */

const snapshot: RobotStatusSnapshot = {
  batteryPct: 84,
  room: 'Kitchen',
  activity: 'Docking',
  health: 'ok',
}

const bothUp: RobotStatusSources = {
  heart: { fresh: true, lastSeenAtMs: 5_000 },
  brain: { fresh: true, lastSeenAtMs: 5_000 },
}

const bothDown: RobotStatusSources = { heart: { fresh: false }, brain: { fresh: false } }

function tile(merged: ReturnType<typeof mergeRobotStatus>, id: string) {
  const found = merged.tiles.find((t) => t.id === id)
  assert.ok(found, `expected a ${id} tile`)
  return found
}

describe('mergeRobotStatus', () => {
  it('marks live readings fresh, with the time they were seen', () => {
    const merged = mergeRobotStatus(snapshot, null, bothUp)

    assert.equal(tile(merged, 'battery').value, '84%')
    assert.equal(tile(merged, 'battery').fresh, true)
    assert.equal(tile(merged, 'battery').lastSeenAtMs, 5_000)
    assert.equal(merged.allCached, false)
  })

  it('shows last-known values but marks every tile as NOT fresh', () => {
    // The lie this prevents: rendering 84% from an hour ago as if the robot just said it.
    const merged = mergeRobotStatus(null, { snapshot, seenAtMs: 1_000 }, bothDown)

    assert.equal(tile(merged, 'room').value, 'Kitchen')
    assert.ok(merged.tiles.every((t) => t.fresh === false), 'no tile may claim to be fresh')
    assert.ok(merged.tiles.every((t) => t.lastSeenAtMs === 1_000))
    assert.equal(merged.allCached, true)
  })

  it('says Unknown rather than inventing a value when nothing was ever seen', () => {
    const merged = mergeRobotStatus(null, null, bothDown)

    assert.deepEqual(
      merged.tiles.map((t) => t.value),
      ['Unknown', 'Unknown', 'Unknown', 'Unknown'],
    )
    // No tone either — a made-up health colour would read as a real reading.
    assert.equal(tile(merged, 'health').tone, undefined)
  })

  it('colours health by what the robot reported', () => {
    const faulted = mergeRobotStatus({ ...snapshot, health: 'fault' }, null, bothUp)
    assert.equal(tile(faulted, 'health').value, 'Fault')
    assert.equal(tile(faulted, 'health').tone, 'danger')

    const degraded = mergeRobotStatus({ ...snapshot, health: 'degraded' }, null, bothUp)
    assert.equal(tile(degraded, 'health').tone, 'warn')
  })

  it('reports each link separately, and the robot-to-brain link as both', () => {
    const heartOnly = mergeRobotStatus(snapshot, null, {
      heart: { fresh: true, lastSeenAtMs: 9 },
      brain: { fresh: false },
    })

    const links = Object.fromEntries(heartOnly.links.map((l) => [l.id, l.up]))
    assert.deepEqual(links, { robot: true, brain: false, core: false })
    // Robot up, Brain down: not "all cached", because the robot half is still live.
    assert.equal(heartOnly.allCached, false)
  })

  it('reports the newer of the two halves as last seen', () => {
    const merged = mergeRobotStatus(snapshot, null, {
      heart: { fresh: true, lastSeenAtMs: 100 },
      brain: { fresh: true, lastSeenAtMs: 900 },
    })
    assert.equal(merged.lastSeenAtMs, 900)
  })
})
