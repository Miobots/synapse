import { Text } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import type { CapabilityState } from '../capabilities/merge'

/**
 * The human-readable half of a capability's state: the note when degraded, the reason when
 * unavailable, nothing when available.
 *
 * This is the one place that turns a `CapabilityState` into words on screen. CLAUDE.md's rule —
 * every capability-driven control has the same three states, and a dead control always carries a
 * human reason — is a rule about *one* rendering, so both the capability button (`Capability`) and
 * the map's tap-to-drive control (`MapScreen`) render their state through here rather than each
 * writing their own colours and copy.
 */
export function CapabilityStateText({ state }: { state: CapabilityState }) {
  const { theme: C } = useTheme()

  if (state.status === 'degraded') {
    return <Text style={{ color: C.yellow, fontSize: 12, ...font(500) }}>{state.note}</Text>
  }
  if (state.status === 'unavailable') {
    return <Text style={{ color: C.danger, fontSize: 12, ...font(500) }}>{state.reason}</Text>
  }
  return null
}
