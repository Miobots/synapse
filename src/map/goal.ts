export function mapGoalBlockReason(liveMap: boolean, mapFresh: boolean, demoTaps: boolean): string | undefined {
  if (!liveMap && !demoTaps) return "Not sent — this is a demo map, not Brian's."
  if (liveMap && !mapFresh) return 'Not sent — the map is out of date.'
  return undefined
}
