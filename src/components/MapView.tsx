import { memo, useMemo, useState, type ReactElement } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg'
import { useTheme } from '../context/ThemeContext'
import type { PosePayload } from '../protocol'
import { buildOccupancyPath, inBounds } from '../map/grid'
import { cellFromViewPoint, placePose, worldFromCell } from '../map/pose'
import { Cell, type OccupancyGrid } from '../map/types'

interface MapViewProps {
  grid: OccupancyGrid
  pose?: PosePayload
  /**
   * Measurement switch, not a feature. `true` draws one `<Rect>` per cell — the obvious
   * implementation — so the two can be compared on a device at the same size and update rate.
   * The default, `false`, is the batched single-`<Path>` render (see `buildOccupancyPath`).
   */
  perCell?: boolean
  /** S2.3 — called with the world point (metres) under a tap on the map. */
  onTap?: (point: { x: number; y: number }) => void
}

/**
 * Draws an occupancy grid with `react-native-svg`, which the app already depends on.
 *
 * The background is one `<Rect>` in the "unknown" colour; only free and occupied cells are drawn on
 * top. Unknown is the majority of a real map, so painting it as the background rather than as cells
 * keeps the work proportional to what is actually known.
 *
 * Taps are hit-tested against the same fit the drawing uses (see `cellFromViewPoint`), so the cell
 * under the finger is the cell the goal is sent to. A tap in the letterbox is ignored.
 */
export const MapView = memo(function MapView({ grid, pose, perCell, onTap }: MapViewProps) {
  const { theme: C } = useTheme()
  const { width, height } = grid
  const [view, setView] = useState<{ width: number; height: number }>()

  const freePath = useMemo(() => buildOccupancyPath(grid, Cell.Free), [grid])
  const occupiedPath = useMemo(() => buildOccupancyPath(grid, Cell.Occupied), [grid])

  function handleLayout(event: LayoutChangeEvent): void {
    const { width: w, height: h } = event.nativeEvent.layout
    setView({ width: w, height: h })
  }

  function handlePress(event: { nativeEvent: { locationX: number; locationY: number } }): void {
    if (!onTap || !view) return
    const { locationX, locationY } = event.nativeEvent
    const cell = cellFromViewPoint(grid, view, { x: locationX, y: locationY })
    const col = Math.floor(cell.col)
    const row = Math.floor(cell.row)
    if (!inBounds(grid, col, row)) return
    // The centre of the tapped cell, so the goal is a definite spot rather than a finger-offset.
    onTap(worldFromCell(grid, col + 0.5, row + 0.5))
  }

  return (
    <View style={{ flex: 1 }} onLayout={handleLayout}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onPress={handlePress}
      >
        <Rect x={0} y={0} width={width} height={height} fill={C.mapUnknown} />
        {perCell ? (
          <Cells grid={grid} />
        ) : (
          <>
            <Path d={freePath} fill={C.mapFree} />
            <Path d={occupiedPath} fill={C.mapOccupied} />
          </>
        )}
        {pose && <PoseMarker pose={pose} grid={grid} />}
      </Svg>
    </View>
  )
})

function Cells({ grid }: { grid: OccupancyGrid }) {
  const { theme: C } = useTheme()

  return (
    <>
      {useMemo(() => {
        const rects: ReactElement[] = []
        for (let row = 0; row < grid.height; row++) {
          for (let col = 0; col < grid.width; col++) {
            const value = grid.cells[row * grid.width + col]
            if (value === Cell.Unknown) continue
            rects.push(
              <Rect
                key={`${col},${row}`}
                x={col}
                y={row}
                width={1}
                height={1}
                fill={value === Cell.Occupied ? C.mapOccupied : C.mapFree}
              />,
            )
          }
        }
        return rects
      }, [grid, C])}
    </>
  )
}

function PoseMarker({ pose, grid }: { pose: PosePayload; grid: OccupancyGrid }) {
  const { theme: C } = useTheme()

  const { col, row, degrees } = placePose(grid, pose)
  // Sized against the grid so the robot stays visible whether the map is 64 or 512 cells across.
  const r = Math.max(2, Math.min(grid.width, grid.height) * 0.025)

  return (
    <G transform={`translate(${col} ${row}) rotate(${degrees})`}>
      <Circle r={r} fill={C.mapPose} stroke={C.mapUnknown} strokeWidth={r * 0.35} />
      {/* A nose pointing along the heading — the "right way" the robot faces. */}
      <Polygon
        points={`${r * 1.9},0 ${r * 0.1},${r * 0.8} ${r * 0.1},${-r * 0.8}`}
        fill={C.mapPose}
        stroke={C.mapUnknown}
        strokeWidth={r * 0.25}
      />
    </G>
  )
}
