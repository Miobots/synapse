import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { argumentLines, auditLine, chainBanner, secondsLeft } from './format.ts'

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

describe('audit wording (S5.2)', () => {
  const base = { id: 1, at_ms: 1, prev_hash: '', hash: 'ab' }
  it('names the approver of an action, and says when none was needed', () => {
    assert.deepEqual(auditLine({ ...base, event: 'tool_call', tool: 'open_app_or_url', args: { target: 'calculator' }, approved_by: 'synapse-app' }), {
      title: 'open_app_or_url · target: "calculator"',
      detail: 'approved by synapse-app',
    })
    assert.equal(auditLine({ ...base, event: 'tool_call', tool: 'system.get_status', args: {} }).detail, 'read only, no approval needed')
    assert.equal(auditLine({ ...base, event: 'killswitch_on', approved_by: 'synapse-app' }).title, 'Laptop access switched off')
    assert.deepEqual(auditLine({ ...base, event: 'approval_rejected', tool: 'run_script', args: { id: 'backup' }, approved_by: 'synapse-app' }), {
      title: 'Not run: run_script · id: "backup"',
      detail: 'rejected by synapse-app',
    })
    assert.equal(auditLine({ ...base, event: 'approval_unanswered', tool: 'run_script', args: {} }).detail, 'nobody answered in time; waiting in the inbox')
  })

  it('says verified, or names the tampered row', () => {
    assert.match(chainBanner({ ok: true, checked: 3 }), /^Verified: all 3 rows/)
    assert.match(chainBanner({ ok: false, checked: 3, first_bad_id: 2 }), /^Tampered: row 2 /)
  })
})
