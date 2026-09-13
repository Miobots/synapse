import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import { Capability } from '../components/Capability'
import { StalenessBanner } from '../components/StalenessBanner'
import { useCapabilities } from '../capabilities/hooks'
import type { CapabilitySources } from '../capabilities/merge'

type Combo = 'both-fresh' | 'heart-only' | 'brain-only' | 'none'

const COMBOS: Record<Combo, CapabilitySources> = {
  'both-fresh': {
    heart: { fresh: true, lastSeenAtMs: Date.now() },
    brain: { fresh: true, lastSeenAtMs: Date.now() },
  },
  'heart-only': {
    heart: { fresh: true, lastSeenAtMs: Date.now() },
    brain: { fresh: false },
  },
  'brain-only': {
    heart: { fresh: false },
    brain: { fresh: true, lastSeenAtMs: Date.now() },
  },
  none: { heart: { fresh: false }, brain: { fresh: false } },
}

const COMBO_LABEL: Record<Combo, string> = {
  'both-fresh': 'Both',
  'heart-only': 'Robot only',
  'brain-only': 'Brain only',
  none: 'None',
}

export function HomeScreen() {
  const { theme: C } = useTheme()
  const [combo, setCombo] = useState<Combo>('both-fresh')
  const { items, missing, lastSeenAtMs } = useCapabilities(COMBOS[combo])
  const showBanner = missing.heart && missing.brain

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ gap: 16, padding: 20 }}>
        <Text style={{ color: C.text, fontSize: 16, ...font(700) }}>Capabilities</Text>

        {showBanner && <StalenessBanner lastSeenAtMs={lastSeenAtMs} />}

        {items.map((item) => (
          <Capability
            key={item.id}
            name={item.label}
            title={item.action}
            state={item.state}
            onPress={() => {}}
          />
        ))}
      </ScrollView>

      {__DEV__ && (
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: C.border,
            backgroundColor: C.surface,
          }}
        >
          {(Object.keys(COMBOS) as Combo[]).map((c) => (
            <Pressable
              key={c}
              onPress={() => setCombo(c)}
              style={{
                borderRadius: 8,
                paddingVertical: 6,
                paddingHorizontal: 10,
                backgroundColor: combo === c ? C.primary : C.card,
              }}
            >
              <Text
                style={{
                  color: combo === c ? '#FFFFFF' : C.text,
                  fontSize: 12,
                  ...font(600),
                }}
              >
                {COMBO_LABEL[c]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}