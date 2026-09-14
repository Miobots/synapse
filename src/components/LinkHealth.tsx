import { Text, View } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import type { LinkItem } from '../status/types'

export function LinkHealth({ links }: { links: LinkItem[] }) {
  const { theme: C } = useTheme()

  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          color: C.muted,
          fontSize: 11,
          ...font(700),
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
      >
        Link health
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {links.map((link) => (
          <View
            key={link.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: C.card,
              borderWidth: 1,
              borderColor: link.up ? C.green : C.danger,
              borderRadius: 999,
              paddingVertical: 6,
              paddingHorizontal: 12,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: link.up ? C.green : C.danger,
              }}
            />
            <Text style={{ color: C.text, fontSize: 12, ...font(600) }}>{link.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}