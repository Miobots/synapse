import { Text, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import { Capability } from '../components/Capability'

export function HomeScreen() {
  const { theme: C } = useTheme()

  return (
    <View style={{ flex: 1, gap: 24, padding: 20, backgroundColor: C.bg }}>
      <Text style={{ color: C.text, fontSize: 16, ...font(700) }}>Capability states</Text>

      <Capability
        name="navigation"
        title="Go to kitchen"
        state={{ status: 'available' }}
        onPress={() => {}}
      />
      <Capability
        name="voice"
        title="Speak out loud"
        state={{ status: 'degraded', note: 'Running on the backup voice — onboard mic is busy.' }}
        onPress={() => {}}
      />
      <Capability
        name="memory"
        title="Show memories"
        state={{ status: 'unavailable', reason: "Can't reach the Brain right now." }}
        onPress={() => {}}
      />
    </View>
  )
}