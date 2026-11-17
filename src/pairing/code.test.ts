import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pairingCode } from './code.ts'

describe('pairing code input', () => {
  it('accepts six digits however they are spaced', () => {
    assert.equal(pairingCode('418902'), '418902')
    assert.equal(pairingCode('418 902'), '418902')
    assert.equal(pairingCode(' 418-902 '), '418902')
  })

  it('refuses anything that is not exactly six digits', () => {
    for (const input of ['', '41890', '4189023', '41a902', '418 90']) {
      assert.equal(pairingCode(input), undefined, input)
    }
  })
})
