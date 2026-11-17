import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pushUnavailableReason } from './reason.ts'

const ready = { isDevice: true, inExpoGo: false, platform: 'android', projectId: 'p', permission: 'granted' as const }

describe('push availability', () => {
  it('is available on a real phone with a project id and permission', () => {
    assert.equal(pushUnavailableReason(ready), undefined)
    assert.equal(pushUnavailableReason({ ...ready, platform: 'ios', inExpoGo: true }), undefined)
  })

  it('says plainly why not, in the order a person would fix it', () => {
    assert.match(pushUnavailableReason({ ...ready, platform: 'web' })!, /phone only/)
    assert.match(pushUnavailableReason({ ...ready, isDevice: false })!, /emulator/)
    assert.match(pushUnavailableReason({ ...ready, inExpoGo: true })!, /Expo Go/)
    assert.match(pushUnavailableReason({ ...ready, projectId: undefined })!, /project ID/)
    assert.match(pushUnavailableReason({ ...ready, permission: 'denied' })!, /turned off/)
  })
})
