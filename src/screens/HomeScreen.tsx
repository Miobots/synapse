import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import { Capability } from '../components/Capability'
import { LinkHealth } from '../components/LinkHealth'
import { StatusTile } from '../components/StatusTile'
import { StalenessBanner } from '../components/StalenessBanner'
import { useCapabilities } from '../capabilities/hooks'
import { useRobotStatus } from '../status/hooks'
import type { CapabilitySources } from '../capabilities/merge'
import type { RobotStatusSnapshot } from '../status/types'

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

const STATUS_BY_COMBO: Partial<Record<Combo, RobotStatusSnapshot>> = {
  'both-fresh': { batteryPct: 84, room: 'Kitchen', activity: 'Docking', health: 'ok' },
  'heart-only': { batteryPct: 84, room: 'Kitchen', activity: 'Idle', health: 'ok' },
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

  const capabilitySources = COMBOS[combo]
  const { items, missing, lastSeenAtMs } = useCapabilities(capabilitySources)
  const { tiles, links } = useRobotStatus({
    heart: {
      fresh: capabilitySources.heart.fresh,
      snapshot: STATUS_BY_COMBO[combo],
      lastSeenAtMs: capabilitySources.heart.lastSeenAtMs,
    },
    brain: {
      fresh: capabilitySources.brain.fresh,
      lastSeenAtMs: capabilitySources.brain.lastSeenAtMs,
    },
  })
  const showBanner = missing.heart && missing.brain

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ gap: 16, padding: 20 }}>
        <Text style={{ color: C.text, fontSize: 16, ...font(700) }}>Status</Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {tiles.map((tile) => (
            <StatusTile
              key={tile.id}
              label={tile.label}
              value={tile.value}
              fresh={tile.fresh}
              lastSeenAtMs={tile.lastSeenAtMs}
              tone={tile.tone}
            />
          ))}
        </View>

        <LinkHealth links={links} />

        <View style={{ height: 1, backgroundColor: C.border }} />

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