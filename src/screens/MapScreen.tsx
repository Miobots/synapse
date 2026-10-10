import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import { formatTime } from '../utils/format'
import { MapView } from '../components/MapView'
import { countCells } from '../map/grid'
import { useDevMapFeed, useFrameRate, useMap } from '../map/hooks'
import type { OccupancyGrid } from '../map/types'

const SIZES = [64, 128, 256] as const

/**
 * M-82 / S2.1 — draws the robot's map and keeps the last one.
 *
 * The exit check is that it stays smooth while the pose updates about five times a second. The dev
 * overlay is how that is judged rather than guessed: it reports measured FPS and lets the same grid
 * be switched between the batched-path render and one-rect-per-cell, and resized, so the decision
 * (see `buildOccupancyPath`) can be made by watching, not by assuming.
 */
export function MapScreen() {
  const { theme: C } = useTheme()

  const [connected, setConnected] = useState(true)
  const [ticking, setTicking] = useState(true)
  const [size, setSize] = useState<(typeof SIZES)[number]>(128)
  const [perCell, setPerCell] = useState(false)

  // Until the map topic exists in the protocol, only the dev build has anything to draw. A
  // production build holds no map rather than a fabricated one — the app must not invent state.
  const feed = useDevMapFeed({ connected: __DEV__ && connected, ticking: __DEV__ && ticking, size })
  const { grid, pose, fresh, lastSeenAtMs } = useMap(feed)

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
