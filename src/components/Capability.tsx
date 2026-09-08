import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'

export type CapabilityState =
  | { status: 'available' }
  | { status: 'degraded'; note: string }
  | { status: 'unavailable'; reason: string }

interface CapabilityProps {
  name: string
  title: string
  state: CapabilityState
  onPress: () => void
  style?: StyleProp<ViewStyle>
}

export function Capability({ name, title, state, onPress, style }: CapabilityProps) {
  const { theme: C } = useTheme()
  const usable = state.status !== 'unavailable'

  return (
    <View style={[{ gap: 8 }, style]}>
      <Text
        style={{
          color: C.muted,
          fontSize: 11,
          ...font(700),
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        {name}
      </Text>

      <Pressable
        onPress={usable ? onPress : undefined}
        disabled={!usable}
        accessibilityState={{ disabled: !usable }}
        style={{
          backgroundColor: usable ? C.primary : C.card,
          borderWidth: 1,
          borderColor: usable ? C.primary : C.border,
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: usable ? '#FFFFFF' : C.muted, fontSize: 15, ...font(700) }}>
          {title}
        </Text>
      </Pressable>

      {state.status === 'degraded' && (
        <Text style={{ color: C.yellow, fontSize: 12, ...font(500) }}>{state.note}</Text>
      )}
      {state.status === 'unavailable' && (
        <Text style={{ color: C.danger, fontSize: 12, ...font(500) }}>{state.reason}</Text>
      )}
    </View>
  )
}