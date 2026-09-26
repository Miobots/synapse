import type { CapabilityStatus } from '../protocol/index.ts'
import { type CapabilityHalf, halfOf, presentationFor } from './catalog.ts'

/**
 * S1.2 — merge the two halves of the capability list.
 *
 * The list arrives in two pieces (TASKS.md S1.2). The robot publishes what the robot can verify;
 * the Brain publishes the cloud side. Each half can be missing on its own, and the app shows the
 * union.
 *
 * This used to map a hard-coded catalog against a `fresh: boolean`, which meant `degraded` could
 * never be produced and every "reason" shown to the user was written here rather than carried
 * from the wire. Both defeat the point of I2: the app is supposed to be honest about what the
 * robot actually said, not plausible.
 */

/** What the UI renders for one capability. */
export type CapabilityState =
  | { status: 'available' }
  | { status: 'degraded'; note: string }
  | { status: 'unavailable'; reason: string }

export interface RenderedCapability {
  id: string
  label: string
  action: string
  half: CapabilityHalf
  state: CapabilityState
}

export interface HalfSource {
  fresh: boolean
  lastSeenAtMs?: number
}

export interface CapabilitySources {
  heart: HalfSource
  brain: HalfSource
  /** Capabilities exactly as published, keyed by id. */
  capabilities?: Record<string, CapabilityStatus>
}

export interface MergedCapabilities {
  items: RenderedCapability[]
  missing: { heart: boolean; brain: boolean }
  stale: boolean
  lastSeenAtMs?: number
}

const REASON_FOR_HALF: Record<CapabilityHalf, string> = {
  heart: 'Robot unreachable right now.',
  brain: "Can't reach the Brain right now.",
}

const FALLBACK_NOTE = 'Reduced — the robot did not say why.'

/**
 * Turns one published status into what the UI renders.
 *
 * `degraded` and `unavailable` carry their own text. Where the publisher omitted it we say so
 * plainly instead of inventing a reason — a made-up explanation is worse than an absent one.
 */
function toRenderState(status: CapabilityStatus): CapabilityState {
  switch (status.state) {
    case 'degraded':
      return { status: 'degraded', note: status.note ?? FALLBACK_NOTE }
    case 'unavailable':
      return { status: 'unavailable', reason: status.reason ?? 'Unavailable right now.' }
    default:
      return { status: 'available' }
  }
}

export function mergeCapabilities(sources: CapabilitySources): MergedCapabilities {
  const missing = { heart: !sources.heart.fresh, brain: !sources.brain.fresh }
  const published = sources.capabilities ?? {}

  const items = Object.entries(published)
    .map(([id, status]): RenderedCapability => {
      const presentation = presentationFor(id)
      const half = halfOf(id)

      return {
        id,
        label: presentation.label,
        action: presentation.action,
        half,
        // A stale half's controls are disabled with the transport reason. A fresh half shows what
        // the publisher actually said, degraded notes included.
        state: missing[half]
          ? { status: 'unavailable', reason: REASON_FOR_HALF[half] }
          : toRenderState(status),
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  const lastSeenAtMs = Math.max(sources.heart.lastSeenAtMs ?? 0, sources.brain.lastSeenAtMs ?? 0)

  return {
    items,
    missing,
    stale: missing.heart || missing.brain,
    lastSeenAtMs: lastSeenAtMs > 0 ? lastSeenAtMs : undefined,
  }
}
