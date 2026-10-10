import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import { formatTime } from '../utils/format'
import { MapView } from '../components/MapView'
import { countCells } from '../map/grid'
import { useDevMapFeed, useFrameRate, useMap } from '../map/hooks'
import { useBrainLink } from '../capabilities/hooks'
import type { MapSource, OccupancyGrid } from '../map/types'

const SIZES = [64, 128, 256] as const

/**
 * M-83 / S2.2 — draws the robot where it is, pointing the right way, updating live.
 *
 * The pose comes off the link (`state.pose`) the moment the robot publishes it, and the dev fixture
 * stands in until then so the marker can still be watched moving. The grid does not yet ride the
 * wire (S2.1), so it stays a fixture. Only one screen is mounted at a time, so the link this screen
 * opens is a fresh connection when the Map tab opens and is stopped on the way out — it does not
 * sit alongside Home's.
 */
export function MapScreen() {
  const { theme: C } = useTheme()

  const [connected, setConnected] = useState(true)
  const [ticking, setTicking] = useState(true)
  const [size, setSize] = useState<(typeof SIZES)[number]>(128)
  const [perCell, setPerCell] = useState(false)

  const live = useBrainLink({ url: process.env.EXPO_PUBLIC_BRAIN_URL })

  // Until the map topic exists in the protocol, only the dev build has a grid to draw. A production
  // build holds no map rather than a fabricated one — the app must not invent state. The fixture's
  // pose stops ticking once a live pose is arriving so the two never fight over the marker.
  const feed = useDevMapFeed({
    connected: __DEV__ && connected,
    ticking: __DEV__ && ticking && !live.pose,
    size,
  })

  const source = useMemo<MapSource>(() => {
    // The fixture exists only in development. A production build must never draw a fabricated map
    // or invent a robot position just because a link came up (CLAUDE.md: the app holds no
    // authority). So the grid and the fixture pose are both gated on `__DEV__`; the live pose off
    // the wire is not.
    const grid = __DEV__ ? feed.snapshot?.grid : undefined
    const pose = live.pose ?? (__DEV__ ? feed.snapshot?.pose : undefined)
    const fresh = (__DEV__ && connected) || live.status === 'connected'
    return grid || pose
      ? {
          fresh,
          snapshot: { grid, pose },
          lastSeenAtMs: live.poseAtMs ?? (__DEV__ ? feed.lastSeenAtMs : undefined),
        }
      : { fresh: false }
  }, [feed.snapshot, feed.lastSeenAtMs, live.pose, live.poseAtMs, live.status, connected])

  const { grid, pose, fresh, lastSeenAtMs } = useMap(source)

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View
        style={{
          flex: 1,
          margin: 16,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: C.border,
          overflow: 'hidden',
          backgroundColor: C.mapUnknown,
        }}
      >
        {grid ? (
          <MapView grid={grid} pose={pose} perCell={perCell} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.muted, fontSize: 14, ...font(500) }}>
              Waiting for the robot's map…
            </Text>
          </View>
        )}

        {!fresh && grid && (
          <View
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              borderRadius: 8,
              paddingVertical: 4,
              paddingHorizontal: 10,
              backgroundColor: C.surface,
              borderWidth: 1,
              borderColor: C.yellow,
            }}
          >
            <Text style={{ color: C.yellow, fontSize: 12, ...font(700) }}>
              Cached · {formatTime(lastSeenAtMs)}
            </Text>
          </View>
        )}
      </View>

      {__DEV__ && (
        <DevHud
          grid={grid}
          size={size}
          perCell={perCell}
          connected={connected}
          ticking={ticking}
          onSize={setSize}
          onPerCell={setPerCell}
          onConnect={setConnected}
          onTick={setTicking}
        />
      )}
    </View>
  )
}

interface DevHudProps {
  grid?: OccupancyGrid
  size: (typeof SIZES)[number]
  perCell: boolean
  connected: boolean
  ticking: boolean
  onSize: (size: (typeof SIZES)[number]) => void
  onPerCell: (perCell: boolean) => void
  onConnect: (connected: boolean) => void
  onTick: (ticking: boolean) => void
}

function DevHud({
  grid,
  size,
  perCell,
  connected,
  ticking,
  onSize,
  onPerCell,
  onConnect,
  onTick,
}: DevHudProps) {
  const { theme: C } = useTheme()
  const fps = useFrameRate()
  const counts = useMemo(() => (grid ? countCells(grid) : undefined), [grid])

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: C.border,
        backgroundColor: C.surface,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
      }}
    >
      <Text style={{ color: C.muted, fontSize: 11, ...font(600) }}>
        {fps} fps · {size}×{size}
        {counts ? ` · free ${counts.free} · occupied ${counts.occupied} · unknown ${counts.unknown}` : ''}
        {perCell ? ' · per-cell rects' : ' · batched path'}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label={connected ? 'Disconnect' : 'Reconnect'} active={!connected} onPress={() => onConnect(!connected)} />
        <Chip label={ticking ? 'Pause' : 'Play'} active={!ticking} onPress={() => onTick(!ticking)} />
        <Chip label={perCell ? 'Batched path' : 'Per-cell rects'} active={perCell} onPress={() => onPerCell(!perCell)} />
        {SIZES.map((s) => (
          <Chip key={s} label={`${s}²`} active={size === s} onPress={() => onSize(s)} />
        ))}
      </View>
    </View>
  )
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme: C } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: active ? C.primary : C.card,
      }}
    >
      <Text style={{ color: active ? '#FFFFFF' : C.text, fontSize: 12, ...font(600) }}>{label}</Text>
    </Pressable>
  )
}
