import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import { Capability } from '../components/Capability'
import { LinkHealth } from '../components/LinkHealth'
import { StatusTile } from '../components/StatusTile'
import { StalenessBanner } from '../components/StalenessBanner'
import { useCapabilities, type LiveLink } from '../capabilities/hooks'
import { useRobotStatus } from '../status/hooks'
import type { CapabilitySources } from '../capabilities/merge'
import type { RobotStatusSnapshot } from '../status/types'
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

const STATUS_BY_COMBO: Partial<Record<Combo, RobotStatusSnapshot>> = {
  'both-fresh': { batteryPct: 84, isCharging: true, room: 'Kitchen', activity: 'Docking', health: 'ok' },
  'heart-only': { batteryPct: 84, isCharging: false, room: 'Kitchen', activity: 'Idle', health: 'ok' },
}

const COMBO_LABEL: Record<Combo, string> = {
  live: 'Live',
  'both-fresh': 'Both',
  'heart-only': 'Robot only',
  'brain-only': 'Brain only',
  none: 'None',
}

export function HomeScreen({ live }: { live: LiveLink }) {
  const { theme: C } = useTheme()
  const [combo, setCombo] = useState<Combo>('live')

  const sources = combo === 'live' ? live : FIXTURES[combo]

  const { items, missing, lastSeenAtMs } = useCapabilities(sources)

  // Battery is real telemetry; room, activity and health stay unknown until their publishers exist.
  const { tiles, links } = useRobotStatus({
    heart: {
      fresh: sources.heart.fresh,
      snapshot: combo === 'live' && live.battery ? { batteryPct: live.battery.percentage, isCharging: live.battery.is_charging } : STATUS_BY_COMBO[combo],
      snapshotFresh: combo === 'live' ? live.batteryFresh : sources.heart.fresh,
      lastSeenAtMs: combo === 'live' ? live.batteryAtMs : sources.heart.lastSeenAtMs,
    },
    brain: {
      fresh: sources.brain.fresh,
      lastSeenAtMs: sources.brain.lastSeenAtMs,
    },
  })

  // TASKS.md S1.2, row 4: both halves gone -> last-known everything, with a staleness banner.
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
