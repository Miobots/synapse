import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_GRID_SIZE, DEFAULT_RESOLUTION, fixtureGrid, fixturePose } from './fixture.ts'
import type { MapSource, OccupancyGrid, MergedMap } from './types.ts'
import type { PosePayload } from '../protocol/index.ts'

interface LastKnown {
  grid?: OccupancyGrid
  pose?: PosePayload
  seenAtMs?: number
}

/**
 * Keeps the last map (and last pose) we saw, so the screen still draws something with nothing
 * connected.
 *
 * Structurally the same as `useRobotStatus`: the live snapshot is used while it is fresh, and the
 * last one is kept in a ref — written in an effect, never during render, because mutating a ref
 * while rendering is torn up by StrictMode's double invocation. Grid and pose are kept separately,
 * because they arrive on their own clocks: a pose update must not wipe a map we already have, or a
 * map update must not drop the robot's position.
 *
 * What the screen gets back is a `fresh` flag *and* the data, never one without the other, so stale
 * map data cannot be presented as live (CLAUDE.md's one way a read-only app can still lie).
 */
export function useMap(source: MapSource): MergedMap {
  const lastKnown = useRef<LastKnown>({})

  useEffect(() => {
    if (!source.fresh) return
    lastKnown.current = {
      grid: source.snapshot?.grid ?? lastKnown.current.grid,
      pose: source.snapshot?.pose ?? lastKnown.current.pose,
      seenAtMs: source.lastSeenAtMs ?? lastKnown.current.seenAtMs,
    }
  }, [source.fresh, source.snapshot, source.lastSeenAtMs])

  return useMemo(() => {
    const live = source.fresh ? source.snapshot : undefined

    return {
      grid: live?.grid ?? lastKnown.current.grid,
      pose: live?.pose ?? lastKnown.current.pose,
      fresh: source.fresh,
      lastSeenAtMs: source.lastSeenAtMs ?? lastKnown.current.seenAtMs,
    }
  }, [source.fresh, source.snapshot, source.lastSeenAtMs])
}

interface DevMapFeedOptions {
  /** Whether the pose advances. Pausing freezes the robot but keeps the link "up". */
  ticking?: boolean
  /** Whether the map is reachable. Dropping this is the "pull the plug" test. */
  connected?: boolean
  intervalMs?: number
  size?: number
  resolution?: number
}

/**
 * Drives the fixture at a fixed rate so the renderer can be watched redrawing, and so the link can
 * be "unplugged" on demand. Development only — the real feed will arrive over the link.
 */
export function useDevMapFeed(options: DevMapFeedOptions = {}): MapSource {
  const {
    ticking = true,
    connected = true,
    intervalMs = 200,
    size = DEFAULT_GRID_SIZE,
    resolution = DEFAULT_RESOLUTION,
  } = options

  // The grid is rebuilt only when its shape changes, not on every tick — the map moves slowly, the
  // robot moves fast, and keeping them on separate clocks is what keeps a 5 Hz pose cheap.
  const grid = useMemo(() => fixtureGrid(size, resolution), [size, resolution])

  const [tick, setTick] = useState(() => ({ t: 0, atMs: Date.now() }))

  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setTick((v) => ({ t: v.t + intervalMs, atMs: Date.now() })), intervalMs)
    return () => clearInterval(id)
  }, [ticking, intervalMs])

  return useMemo(
    () => ({
      fresh: connected,
      snapshot: { grid, pose: fixturePose(size, resolution, tick.t) },
      lastSeenAtMs: tick.atMs,
    }),
    [connected, grid, size, resolution, tick],
  )
}

/**
 * Measured frames per second, for the development overlay. This is the number S2.1's exit check is
 * about, so it is read rather than estimated: counting real frames over a half-second window.
 */
export function useFrameRate(): number {
  const [fps, setFps] = useState(0)

  useEffect(() => {
    const now = () => globalThis.performance?.now?.() ?? Date.now()
    let handle = 0
    let frames = 0
    let windowStart = now()

    const loop = () => {
      frames++
      const t = now()
      if (t - windowStart >= 500) {
        setFps(Math.round((frames * 1000) / (t - windowStart)))
        frames = 0
        windowStart = t
      }
      handle = requestAnimationFrame(loop)
    }

    handle = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(handle)
  }, [])

  return fps
}
