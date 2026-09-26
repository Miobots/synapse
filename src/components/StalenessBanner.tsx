import { Text, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import { formatTime } from '../utils/format'

export function StalenessBanner({ lastSeenAtMs }: { lastSeenAtMs?: number }) {
  const { theme: C } = useTheme()

  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.yellow,
        borderRadius: 12,
        padding: 12,
        gap: 4,
      }}
    >
      <Text style={{ color: C.yellow, fontSize: 13, ...font(700) }}>Last-known data</Text>
      <Text style={{ color: C.muted, fontSize: 12, ...font(500) }}>
        Robot and Brain are unreachable. Showing the last-known list from {formatTime(lastSeenAtMs)} — buttons
        are disabled until a connection returns.
      </Text>
    </View>
  )
}