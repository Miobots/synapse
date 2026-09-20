import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { mergeCapabilities } from './merge.ts'
import { halfOf, presentationFor } from './catalog.ts'
import { HeartCapabilities, BrainCapabilities, type CapabilityStatus } from '../protocol/index.ts'

/**
 * S1.2. The previous merge mapped a hard-coded catalog against a `fresh: boolean`, so `degraded`
 * was unreachable and every reason shown to the user was written in the app rather than carried
 * from the wire. Both defeat I2, which is about the app being honest rather than plausible.
 */

const HEART_HALF: Record<string, CapabilityStatus> = {
  [HeartCapabilities.DRIVING]: { state: 'available' },
  [HeartCapabilities.DOCKING]: { state: 'unavailable', reason: 'no dock in the map yet' },
  [HeartCapabilities.LOCAL_VOICE]: { state: 'degraded', note: 'offline — simple phrasing only' },
}

const BRAIN_HALF: Record<string, CapabilityStatus> = {
  [BrainCapabilities.SMART_HOME]: { state: 'available' },
  [BrainCapabilities.MEMORY]: { state: 'available' },
}

const BOTH = { ...HEART_HALF, ...BRAIN_HALF }
const fresh = (ms = Date.now()) => ({ fresh: true, lastSeenAtMs: ms })
const gone = { fresh: false }

function find(items: ReturnType<typeof mergeCapabilities>['items'], id: string) {
  const found = items.find((i) => i.id === id)
  assert.ok(found, `expected ${id} to be rendered`)
  return found
}

describe('mergeCapabilities — states come off the wire', () => {
  it('renders degraded WITH the publisher\'s own note', () => {
    // The regression that matters: the old merge could only ever emit available/unavailable, so
    // a degraded capability silently rendered as fully working.
    const merged = mergeCapabilities({ heart: fresh(), brain: fresh(), capabilities: BOTH })

    assert.deepEqual(find(merged.items, HeartCapabilities.LOCAL_VOICE).state, {
      status: 'degraded',
      note: 'offline — simple phrasing only',
    })
  })

  it('renders unavailable with the reason the robot gave, not a local one', () => {
    const merged = mergeCapabilities({ heart: fresh(), brain: fresh(), capabilities: BOTH })

    assert.deepEqual(find(merged.items, HeartCapabilities.DOCKING).state, {
      status: 'unavailable',
      reason: 'no dock in the map yet',
    })
  })

  it('says so plainly when a publisher omits its note or reason', () => {
    const merged = mergeCapabilities({
      heart: fresh(),
      brain: fresh(),
      capabilities: { [HeartCapabilities.DRIVING]: { state: 'degraded' } },
    })

    const state = find(merged.items, HeartCapabilities.DRIVING).state
    assert.equal(state.status, 'degraded')
    // An invented explanation would be worse than an absent one.
    assert.match((state as { note: string }).note, /did not say why/)
  })
})

describe('mergeCapabilities — the four presence combinations (S1.2)', () => {
  it('both fresh: everything renders normally', () => {
    const merged = mergeCapabilities({ heart: fresh(), brain: fresh(), capabilities: BOTH })

    assert.deepEqual(merged.missing, { heart: false, brain: false })
    assert.equal(merged.stale, false)
    assert.equal(find(merged.items, HeartCapabilities.DRIVING).state.status, 'available')
    assert.equal(find(merged.items, BrainCapabilities.SMART_HOME).state.status, 'available')
  })

  it('robot only: robot controls live, cloud features unavailable with a reason', () => {
    const merged = mergeCapabilities({ heart: fresh(), brain: gone, capabilities: BOTH })

    assert.equal(find(merged.items, HeartCapabilities.DRIVING).state.status, 'available')
    const cloud = find(merged.items, BrainCapabilities.SMART_HOME).state
    assert.equal(cloud.status, 'unavailable')
    assert.ok((cloud as { reason: string }).reason.length > 0)
  })

  it('brain only: robot offline, but memory and smart home still work', () => {
    // TASKS.md S1.2 calls this "the one everybody forgets".
    const merged = mergeCapabilities({ heart: gone, brain: fresh(), capabilities: BOTH })

    assert.equal(find(merged.items, BrainCapabilities.MEMORY).state.status, 'available')
    assert.equal(find(merged.items, HeartCapabilities.DRIVING).state.status, 'unavailable')
  })

  it('neither: last-known everything, and the list is still rendered', () => {
    const merged = mergeCapabilities({ heart: gone, brain: gone, capabilities: BOTH })

    assert.deepEqual(merged.missing, { heart: true, brain: true })
    assert.equal(merged.stale, true)
    assert.equal(merged.items.length, Object.keys(BOTH).length)
    assert.ok(merged.items.every((i) => i.state.status === 'unavailable'))
  })

  it('reports the newer of the two halves as last seen', () => {
    const merged = mergeCapabilities({
      heart: fresh(1000),
      brain: fresh(5000),
      capabilities: BOTH,
    })
    assert.equal(merged.lastSeenAtMs, 5000)
  })
})

describe('capability identity', () => {
  it('attributes each id to the half that publishes it', () => {
    assert.equal(halfOf(HeartCapabilities.DOCKING), 'heart')
    assert.equal(halfOf(BrainCapabilities.MEMORY), 'brain')
  })

  it('still renders a capability this build has never heard of', () => {
    // A robot on newer firmware must not silently lose controls in an older app.
    const merged = mergeCapabilities({
      heart: fresh(),
      brain: fresh(),
      capabilities: { 'arm-gripper': { state: 'available' } },
    })

    const item = find(merged.items, 'arm-gripper')
    assert.equal(item.label, 'Arm Gripper')
    assert.equal(item.state.status, 'available')
  })

  it('falls back to a readable label for an unknown id', () => {
    assert.equal(presentationFor('robot-health').label, 'Robot health')
    assert.equal(presentationFor('some_new_thing').label, 'Some New Thing')
  })

  it('renders nothing at all before the first manifest arrives', () => {
    const merged = mergeCapabilities({ heart: gone, brain: gone })
    assert.deepEqual(merged.items, [])
  })
})
