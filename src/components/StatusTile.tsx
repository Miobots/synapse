import { Text, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'

function formatClock(ms?: number) {
  if (ms === undefined) return 'a while ago'
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const TONE_COLOR = {
  ok: 'green' as const,
  warn: 'yellow' as const,
  danger: 'danger' as const,
}

interface StatusTileProps {
  label: string
  value: string
  fresh: boolean
  lastSeenAtMs?: number
  tone?: 'ok' | 'warn' | 'danger'
}

export function StatusTile({ label, value, fresh, lastSeenAtMs, tone }: StatusTileProps) {
  const { theme: C } = useTheme()
  const valueColor = tone ? C[TONE_COLOR[tone]] : C.text

  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '46%',
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 12,
        padding: 14,
        gap: 6,
      }}
    >
      <Text
        style={{
          color: C.muted,
          fontSize: 11,
          ...font(700),
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
      >
        {label}
      </Text>
      <Text style={{ color: valueColor, fontSize: 20, ...font(800) }}>{value}</Text>
      {!fresh && (
        <Text style={{ color: C.yellow, fontSize: 11, ...font(600) }}>
          cached · {formatClock(lastSeenAtMs)}
        </Text>
      )}
    </View>
  )
}