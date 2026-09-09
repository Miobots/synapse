import { View, Text } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'

export function HomeScreen() {
  const { theme: C } = useTheme()
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <Text style={{ color: C.muted, fontSize: 14, ...font(500) }}>Home</Text>
    </View>
  )
}
