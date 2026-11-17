import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mapGoalBlockReason } from './goal.ts'

describe('map goal gate', () => {
  it('blocks stale live maps and demo maps without explicit opt-in', () => {
    assert.match(mapGoalBlockReason(true, false, false) ?? '', /out of date/)
    assert.match(mapGoalBlockReason(false, false, false) ?? '', /demo map/)
    assert.equal(mapGoalBlockReason(true, true, false), undefined)
    assert.equal(mapGoalBlockReason(false, false, true), undefined)
  })
})
