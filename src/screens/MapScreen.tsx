import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import { formatTime } from '../utils/format'
import { MapView } from '../components/MapView'
import { CapabilityStateText } from '../components/CapabilityStateText'
import { countCells } from '../map/grid'
import { useDevMapFeed, useFrameRate, useMap } from '../map/hooks'
import { useBrainLink, useCapabilities } from '../capabilities/hooks'
import { HeartCapabilities, Topics, generateUlid, type NavGotoPayload } from '../protocol'
import type { CapabilityState } from '../capabilities/merge'
import type { MapSource, OccupancyGrid } from '../map/types'

const SIZES = [64, 128, 256] as const

/**
 * M-84 / S2.3 — tap the map and the app asks the Brain to send the robot there.
 *
 * The app asks, it never drives (CLAUDE.md): the tap builds a `nav.goto` command and hands it to the
 * Brain. The control is the tap itself, so it is gated by the robot's `driving` capability — and
 * gated *out loud*. If driving is unavailable, the reason is on screen and a tap repeats it rather
 * than doing nothing, because a dead tap reads as a broken app.
 */
export function MapScreen() {
  const { theme: C } = useTheme()

  const [connected, setConnected] = useState(true)
  const [ticking, setTicking] = useState(true)
  const [size, setSize] = useState<(typeof SIZES)[number]>(128)
  const [perCell, setPerCell] = useState(false)
  const [outcome, setOutcome] = useState<string>()

  const live = useBrainLink({ url: process.env.EXPO_PUBLIC_BRAIN_URL })
  const { items } = useCapabilities(live)
  const driving = items.find((item) => item.id === HeartCapabilities.DRIVING)

  // A capability the robot never announced is not ours to assume, so an absent `driving` gates the
  // map just like an unavailable one — with a reason that is true rather than invented.
  const driveState: CapabilityState = driving?.state ?? {
    status: 'unavailable',
    // With the link down no manifest could have arrived, so that — not the robot's silence — is
    // the true reason.
    reason:
      live.status === 'connected'
        ? "Brian hasn't said it can drive yet."
        : "Can't reach the Brain right now.",
  }

  // The fallback grid is a dev fixture, and its coordinates are made up. A tap on it
  // must not become a real goal by accident — a dev build is exactly what gets pointed at the real
  // robot — so sending from it is opt-in, from the dev HUD, for runs against the Fake Heart.
  // Real map taps are sent; this switch governs the fixture only.
  const [demoTaps, setDemoTaps] = useState(false)
  const latestGoal = useRef<string | undefined>(undefined)

  // A production build holds no fabricated map. The fixture moves only until a live map arrives.
  const feed = useDevMapFeed({
    connected: __DEV__ && connected,
    ticking: __DEV__ && ticking && !live.map,
    size,
  })

  const source = useMemo<MapSource>(() => {
    // The fixture exists only in development. A production build must never draw a fabricated map
    // or invent a robot position just because a link came up (CLAUDE.md: the app holds no
    // authority). A real pose is never placed on the fixture's invented coordinates.
    const grid = live.map ?? (__DEV__ ? feed.snapshot?.grid : undefined)
    const pose = live.map
      ? (live.poseFresh ? live.pose : undefined)
      : (__DEV__ ? feed.snapshot?.pose : undefined)
    // A stale pose disappears while the map is fresh; if the map itself goes stale, the entire
    // last-known scene is marked cached by useMap.
    const fresh = live.map ? live.mapFresh : __DEV__ && connected
    return grid || pose
      ? {
          fresh,
          snapshot: { grid, pose },
          lastSeenAtMs: live.mapAtMs && live.poseAtMs
            ? Math.min(live.mapAtMs, live.poseAtMs)
            : live.mapAtMs ?? live.poseAtMs ?? (__DEV__ ? feed.lastSeenAtMs : undefined),
        }
      : { fresh: false }
  }, [feed.snapshot, feed.lastSeenAtMs, live.map, live.mapAtMs, live.mapFresh, live.pose, live.poseAtMs, live.poseFresh, connected])

  const { grid, pose, fresh, lastSeenAtMs } = useMap(source)

  const { command } = live

  const ask = useCallback(
    async (point: { x: number; y: number }) => {
      if (!live.map && !demoTaps) {
        setOutcome("Not sent — this is a demo map, not Brian's.")
        return
      }

      if (driveState.status === 'unavailable') {
        // Never a silent no-op: acknowledge the tap. The reason itself is already on screen, via the
        // shared `CapabilityStateText`, so this line only confirms nothing was sent.
        setOutcome('Not sent — driving is unavailable.')
        return
      }

      const goal: NavGotoPayload = { goal_id: generateUlid(), x: point.x, y: point.y }
      latestGoal.current = goal.goal_id
      setOutcome('Asking the Brain…')

      // Writing to the socket is not an answer. Only the Brain's ACK says whether the robot is
      // going, and a refusal or a silence has to be said as plainly as a yes (ENVELOPE.md §3).
      const result = await command(Topics.NAV_GOTO, goal)
      // A slow answer to an earlier tap must not overwrite the newer one's.
      if (latestGoal.current !== goal.goal_id) return
      setOutcome(
        result.status === 'accepted'
          ? 'Accepted — Brian is on its way.'
          : result.status === 'rejected'
            ? `Brian said no${result.reason ? `: ${result.reason}` : '.'}`
            : result.reason,
      )
    },
    [driveState.status, command, demoTaps, live.map],
  )

  // A result from one capability state must not outlive it: if driving goes from available to
  // unavailable, "Asked Brian to go there." is no longer the truth and must not linger.
  useEffect(() => {
    setOutcome(undefined)
  }, [driveState.status, demoTaps])

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
          <MapView grid={grid} pose={pose} perCell={perCell} onTap={ask} />
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

      <DriveStatus state={driveState} gridPresent={!!grid} demo={!live.map && !demoTaps} outcome={outcome} />

      {__DEV__ && (
        <DevHud
          grid={grid}
          size={size}
          perCell={perCell}
          connected={connected}
          ticking={ticking}
          demoTaps={demoTaps}
          liveMap={!!live.map}
          onSize={setSize}
          onPerCell={setPerCell}
          onConnect={setConnected}
          onTick={setTicking}
          onDemoTaps={setDemoTaps}
        />
      )}
    </View>
  )
}

/**
 * The driving control's one visible line: what it does, or why it will not.
 *
 * Always on screen — the reason is there *before* a tap, not only after a silent one (CLAUDE.md: a
 * dead control with no explanation is a bug). The note/reason itself comes from the shared
 * `CapabilityStateText`, so the copy and colours are the same ones Home's capability buttons use.
 */
function DriveStatus({
  state,
  gridPresent,
  demo,
  outcome,
}: {
  state: CapabilityState
  gridPresent: boolean
  /** The map on screen is the fixture and taps on it are not being sent. */
  demo: boolean
  outcome?: string
}) {
  const { theme: C } = useTheme()

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 10, gap: 4 }}>
      <Text
        style={{
          color: C.muted,
          fontSize: 11,
          ...font(700),
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        Driving
      </Text>

      {!gridPresent ? (
        <Text style={{ color: C.muted, fontSize: 12, ...font(500) }}>
          Waiting for a map to send Brian to.
        </Text>
      ) : demo ? (
        <Text style={{ color: C.muted, fontSize: 12, ...font(500) }}>
          This is a demo map, so taps are not sent.
        </Text>
      ) : state.status === 'available' ? (
        <Text style={{ color: C.muted, fontSize: 12, ...font(500) }}>
          Tap the map to send Brian there.
        </Text>
      ) : (
        <CapabilityStateText state={state} />
      )}

      {outcome && <Text style={{ color: C.text, fontSize: 13, ...font(600) }}>{outcome}</Text>}
    </View>
  )
}

interface DevHudProps {
  grid?: OccupancyGrid
  size: (typeof SIZES)[number]
  perCell: boolean
  connected: boolean
  ticking: boolean
  demoTaps: boolean
  liveMap: boolean
  onSize: (size: (typeof SIZES)[number]) => void
  onPerCell: (perCell: boolean) => void
  onConnect: (connected: boolean) => void
  onTick: (ticking: boolean) => void
  onDemoTaps: (demoTaps: boolean) => void
}

function DevHud({
  grid,
  size,
  perCell,
  connected,
  ticking,
  demoTaps,
  liveMap,
  onSize,
  onPerCell,
  onConnect,
  onTick,
  onDemoTaps,
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
        {fps} fps · {grid ? `${grid.width}×${grid.height}` : `${size}×${size}`}
        {counts ? ` · free ${counts.free} · occupied ${counts.occupied} · unknown ${counts.unknown}` : ''}
        {perCell ? ' · per-cell rects' : ' · batched path'}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label={perCell ? 'Batched path' : 'Per-cell rects'} active={perCell} onPress={() => onPerCell(!perCell)} />
        {!liveMap && <>
          <Chip label={connected ? 'Disconnect' : 'Reconnect'} active={!connected} onPress={() => onConnect(!connected)} />
          <Chip label={ticking ? 'Pause' : 'Play'} active={!ticking} onPress={() => onTick(!ticking)} />
          <Chip label={demoTaps ? 'Stop sending taps' : 'Send taps (Fake Heart)'} active={demoTaps} onPress={() => onDemoTaps(!demoTaps)} />
          {SIZES.map((s) => (
            <Chip key={s} label={`${s}²`} active={size === s} onPress={() => onSize(s)} />
          ))}
        </>}
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
