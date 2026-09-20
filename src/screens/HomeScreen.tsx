import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import { Capability } from '../components/Capability'
import { StalenessBanner } from '../components/StalenessBanner'
import { useBrainLink, useCapabilities } from '../capabilities/hooks'
import type { CapabilitySources } from '../capabilities/merge'
import { HeartCapabilities, BrainCapabilities, type CapabilityStatus } from '../protocol'

/**
 * Fixtures for the four presence combinations (S1.2's exit check), kept so the demo can be shown
 * without a robot on the bench. `live` is the default — the fixtures are an override, not the
 * source, which is the distinction that was missing before.
 */
type Combo = 'live' | 'both-fresh' | 'heart-only' | 'brain-only' | 'none'

const HEART_HALF: Record<string, CapabilityStatus> = {
  [HeartCapabilities.DRIVING]: { state: 'available' },
  [HeartCapabilities.DOCKING]: { state: 'unavailable', reason: 'no dock in the map yet' },
  [HeartCapabilities.RECORDING]: { state: 'available' },
  [HeartCapabilities.LOCAL_VOICE]: { state: 'degraded', note: 'offline — simple phrasing only' },
  [HeartCapabilities.ROBOT_HEALTH]: { state: 'available' },
}

const BRAIN_HALF: Record<string, CapabilityStatus> = {
  [BrainCapabilities.SMART_HOME]: { state: 'available' },
  [BrainCapabilities.LAPTOP_DAEMON]: { state: 'unavailable', reason: 'laptop daemon not running' },
  [BrainCapabilities.MEMORY]: { state: 'available' },
}

const BOTH_HALVES = { ...HEART_HALF, ...BRAIN_HALF }

const FIXTURES: Record<Exclude<Combo, 'live'>, CapabilitySources> = {
  'both-fresh': {
    heart: { fresh: true, lastSeenAtMs: Date.now() },
    brain: { fresh: true, lastSeenAtMs: Date.now() },
    capabilities: BOTH_HALVES,
  },
  'heart-only': {
    heart: { fresh: true, lastSeenAtMs: Date.now() },
    brain: { fresh: false },
    capabilities: BOTH_HALVES,
  },
  'brain-only': {
    heart: { fresh: false },
    brain: { fresh: true, lastSeenAtMs: Date.now() },
    capabilities: BOTH_HALVES,
  },
  none: { heart: { fresh: false }, brain: { fresh: false }, capabilities: BOTH_HALVES },
}

const COMBO_LABEL: Record<Combo, string> = {
  live: 'Live',
  'both-fresh': 'Both',
  'heart-only': 'Robot only',
  'brain-only': 'Brain only',
  none: 'None',
}

export function HomeScreen() {
  const { theme: C } = useTheme()
  const [combo, setCombo] = useState<Combo>('live')

  const live = useBrainLink()
  const sources = combo === 'live' ? live : FIXTURES[combo]

  const { items, missing, lastSeenAtMs } = useCapabilities(sources)

  // TASKS.md S1.2, row 4: both halves gone -> last-known everything, with a staleness banner.
  const showBanner = missing.heart && missing.brain

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ gap: 16, padding: 20 }}>
        <Text style={{ color: C.text, fontSize: 16, ...font(700) }}>Capabilities</Text>

        {showBanner && <StalenessBanner lastSeenAtMs={lastSeenAtMs} />}

        {items.length === 0 && (
          <Text style={{ color: C.muted, fontSize: 13, ...font(500) }}>
            {combo === 'live'
              ? 'Waiting for the robot to say what it can do…'
              : 'No capabilities published.'}
          </Text>
        )}

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
            flexWrap: 'wrap',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: C.border,
            backgroundColor: C.surface,
          }}
        >
          {(Object.keys(COMBO_LABEL) as Combo[]).map((c) => (
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
