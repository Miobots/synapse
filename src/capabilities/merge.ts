import type { CapabilityState } from '../components/Capability'
import type { CapabilityDef, CapabilityHalf, CapabilityId } from './catalog'

export interface HalfSource {
  fresh: boolean
  lastSeenAtMs?: number
}

export interface CapabilitySources {
  heart: HalfSource
  brain: HalfSource
}

export interface RenderedCapability {
  id: CapabilityId
  label: string
  action: string
  half: CapabilityHalf
  state: CapabilityState
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

export function mergeCapabilities(catalog: CapabilityDef[], sources: CapabilitySources): MergedCapabilities {
  const missing = { heart: !sources.heart.fresh, brain: !sources.brain.fresh }
  const lastSeenAtMs = Math.max(sources.heart.lastSeenAtMs ?? 0, sources.brain.lastSeenAtMs ?? 0)

  const items = catalog.map((capability): RenderedCapability => ({
    id: capability.id,
    label: capability.label,
    action: capability.action,
    half: capability.half,
    state: missing[capability.half]
      ? { status: 'unavailable', reason: REASON_FOR_HALF[capability.half] }
      : { status: 'available' },
  }))

  return {
    items,
    missing,
    stale: missing.heart || missing.brain,
    lastSeenAtMs: lastSeenAtMs > 0 ? lastSeenAtMs : undefined,
  }
}