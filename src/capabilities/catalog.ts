import { HeartCapabilities, BrainCapabilities } from '../protocol/index.ts'

/**
 * Presentation metadata for capabilities. **Not** the source of which capabilities exist — that
 * comes off the wire, in `cap.manifest`.
 *
 * The ids are imported from the protocol rather than retyped, because they are a contract with the
 * publisher. Retyping them is how the app ended up listing `driving`/`local-voice` while the Fake
 * Heart published `navigation`/`voice`, with only `docking` in common.
 */

export type CapabilityHalf = 'heart' | 'brain'

export interface CapabilityPresentation {
  label: string
  action: string
  half: CapabilityHalf
}

export const CAPABILITY_PRESENTATION: Record<string, CapabilityPresentation> = {
  [HeartCapabilities.DRIVING]: { label: 'Driving', action: 'Drive', half: 'heart' },
  [HeartCapabilities.DOCKING]: { label: 'Docking', action: 'Dock', half: 'heart' },
  [HeartCapabilities.RECORDING]: { label: 'Recording', action: 'Start recording', half: 'heart' },
  [HeartCapabilities.LOCAL_VOICE]: { label: 'Local voice', action: 'Speak', half: 'heart' },
  [HeartCapabilities.ROBOT_HEALTH]: { label: 'Robot health', action: 'Check health', half: 'heart' },
  [BrainCapabilities.SMART_HOME]: { label: 'Smart home', action: 'Control home', half: 'brain' },
  [BrainCapabilities.LAPTOP_DAEMON]: { label: 'Laptop daemon', action: 'Talk to laptop', half: 'brain' },
  [BrainCapabilities.MEMORY]: { label: 'Memory', action: 'Browse memories', half: 'brain' },
}

const HEART_IDS = new Set<string>(Object.values(HeartCapabilities))

/** Which half published a capability. Unknown ids are attributed to the Brain's cloud-side half. */
export function halfOf(id: string): CapabilityHalf {
  return HEART_IDS.has(id) ? 'heart' : 'brain'
}

/**
 * A capability the manifest announced but this build has never heard of still has to render — a
 * robot on newer firmware must not silently lose controls. Title-cases the id as a fallback label.
 */
export function presentationFor(id: string): CapabilityPresentation {
  const known = CAPABILITY_PRESENTATION[id]
  if (known) return known

  const label = id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return { label, action: label, half: halfOf(id) }
}
