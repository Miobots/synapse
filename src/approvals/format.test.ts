import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { argumentLines, secondsLeft } from './format.ts'

describe('approval card text', () => {
  it('shows every argument exactly, quoted, in a stable order', () => {
    assert.deepEqual(argumentLines({ target: 'Spotify', count: 2, nested: { a: [1] } }), [
      'count: 2',
      'nested: {"a":[1]}',
      'target: "Spotify"',
    ])
  })

  it('counts down and stops at expiry', () => {
    assert.equal(secondsLeft(10_000, 0), 10)
    assert.equal(secondsLeft(10_000, 9_001), 1)
    assert.equal(secondsLeft(10_000, 10_000), undefined)
  })
})
