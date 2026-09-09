import { View, Text } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'

export function CallScreen() {
  const { theme: C } = useTheme()
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <Text style={{ color: C.muted, fontSize: 14, ...font(500) }}>Call</Text>
    </View>
  )
}
