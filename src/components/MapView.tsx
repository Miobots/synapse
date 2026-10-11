import { memo, useMemo, type ReactElement } from 'react'
import Svg, { G, Path, Polygon, Rect } from 'react-native-svg'
import { useTheme } from '../context/ThemeContext'
import type { PosePayload } from '../protocol'
import { buildOccupancyPath } from '../map/grid'
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
}

/**
 * Draws an occupancy grid with `react-native-svg`, which the app already depends on.
 *
 * The background is one `<Rect>` in the "unknown" colour; only free and occupied cells are drawn on
 * top. Unknown is the majority of a real map, so painting it as the background rather than as cells
 * keeps the work proportional to what is actually known.
 */
export const MapView = memo(function MapView({ grid, pose, perCell }: MapViewProps) {
  const { theme: C } = useTheme()
  const { width, height } = grid

  const freePath = useMemo(() => buildOccupancyPath(grid, Cell.Free), [grid])
  const occupiedPath = useMemo(() => buildOccupancyPath(grid, Cell.Occupied), [grid])

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
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

const MARKER_CELLS = 3

function PoseMarker({ pose, grid }: { pose: PosePayload; grid: OccupancyGrid }) {
  const { theme: C } = useTheme()

  const cx = (pose.x - grid.origin.x) / grid.resolution
  const cy = grid.height - (pose.y - grid.origin.y) / grid.resolution
  // SVG rotates clockwise on a y-down canvas; the robot's yaw is counter-clockwise on a y-up map,
  // and the two flips cancel into a single negation.
  const degrees = (-pose.yaw * 180) / Math.PI
  const points = `${MARKER_CELLS},0 ${-MARKER_CELLS},${MARKER_CELLS * 0.7} ${-MARKER_CELLS},${-MARKER_CELLS * 0.7}`

  return (
    <G transform={`translate(${cx} ${cy}) rotate(${degrees})`}>
      <Polygon points={points} fill={C.mapPose} />
    </G>
  )
}
