import { useState } from 'react'
import { View, Text, Pressable, StatusBar } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, Camera, Gamepad2, Phone, CheckSquare } from 'lucide-react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import { HomeScreen } from '../screens/HomeScreen'
import { CameraScreen } from '../screens/CameraScreen'
import { ControlsScreen } from '../screens/ControlsScreen'
import { CallScreen } from '../screens/CallScreen'
import { TasksScreen } from '../screens/TasksScreen'
import type { Screen } from '../types'

const NAV: { screen: Screen; Icon: typeof Home; label: string }[] = [
  { screen: 'home', Icon: Home, label: 'Home' },
  { screen: 'camera', Icon: Camera, label: 'Camera' },
  { screen: 'controls', Icon: Gamepad2, label: 'Drive' },
  { screen: 'call', Icon: Phone, label: 'Call' },
  { screen: 'tasks', Icon: CheckSquare, label: 'Tasks' },
]

const TITLES: Record<Screen, string> = {
  home: 'Brian', camera: 'Live Camera', controls: 'Drive Brian',
  call: 'Call', tasks: 'Schedule',
}

export function AppShell() {
  const { theme: C, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const [screen, setScreen] = useState<Screen>('home')

  const screenMap: Record<Screen, React.ReactNode> = {
    home: <HomeScreen />,
    camera: <CameraScreen />,
    controls: <ControlsScreen />,
    call: <CallScreen />,
    tasks: <TasksScreen />,
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

      <View style={{ height: insets.top, backgroundColor: C.bg }} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 12,
          backgroundColor: C.bg,
        }}
      >
        <Text
          style={{
            color: C.text,
            fontSize: 20,
            ...font(900),
            letterSpacing: -0.4,
          }}
        >
          {TITLES[screen]}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        {screenMap[screen]}
      </View>

      <View
        style={{
          backgroundColor: C.surface,
          borderTopWidth: 1,
          borderTopColor: C.border,
          flexDirection: 'row',
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
        }}
      >
        {NAV.map(({ screen: s, Icon, label }) => {
          const active = screen === s
          return (
            <Pressable
              key={s}
              onPress={() => setScreen(s)}
              style={{ flex: 1, alignItems: 'center', gap: 4 }}
            >
              <Icon size={22} color={active ? C.primary : C.muted} />
              <Text style={{ fontSize: 9, color: active ? C.primary : C.muted, ...font(active ? 700 : 500) }}>
                {label}
              </Text>
              {active && (
                <View
                  style={{
                    position: 'absolute',
                    bottom: -8,
                    width: 18,
                    height: 2,
                    borderRadius: 1,
                    backgroundColor: C.primary,
                  }}
                />
              )}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
