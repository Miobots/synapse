export type CapabilityHalf = 'heart' | 'brain'

export interface CapabilityDef {
  id: string
  label: string
  action: string
  half: CapabilityHalf
}

export const CAPABILITY_CATALOG: CapabilityDef[] = [
  { id: 'driving', label: 'Driving', action: 'Drive', half: 'heart' },
  { id: 'docking', label: 'Docking', action: 'Dock', half: 'heart' },
  { id: 'recording', label: 'Recording', action: 'Start recording', half: 'heart' },
  { id: 'local-voice', label: 'Local voice', action: 'Speak', half: 'heart' },
  { id: 'robot-health', label: 'Robot health', action: 'Check health', half: 'heart' },
  { id: 'smart-home', label: 'Smart home', action: 'Control home', half: 'brain' },
  { id: 'laptop-daemon', label: 'Laptop daemon', action: 'Talk to laptop', half: 'brain' },
  { id: 'memory', label: 'Memory', action: 'Browse memories', half: 'brain' },
]

export type CapabilityId = (typeof CAPABILITY_CATALOG)[number]['id']