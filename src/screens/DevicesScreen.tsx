import { useCallback, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import { Topics } from '@miobots/protocol'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import type { LiveLink } from '../capabilities/hooks'
import { pairingCode } from '../pairing/code'

/**
 * Pair a laptop (S9.2). The laptop shows a six-digit code after `bun run pair`; typing it here is
 * what lets the Brain issue that laptop its own token. Finding a laptop on the network never is.
 */
export function DevicesScreen({ live }: { live: LiveLink }) {
  const { theme: C } = useTheme()
  const [input, setInput] = useState('')
  const [outcome, setOutcome] = useState<string>()
  const [busy, setBusy] = useState(false)
  const code = pairingCode(input)
  const connected = live.status === 'connected'
  const { command } = live

  const pair = useCallback(async () => {
    if (!code) return
    setBusy(true)
    setOutcome('Asking the Brain…')
    const result = await command(Topics.SYS_PAIR_CONFIRM, { code })
    setBusy(false)
    if (result.status === 'accepted') {
      setInput('')
      setOutcome(`Paired: ${result.name ?? 'your laptop'}. It can now connect on its own.`)
    } else {
      setOutcome(result.status === 'rejected' ? `Not paired: ${result.reason ?? 'the Brain said no.'}` : result.reason)
    }
  }, [code, command])

  const canPair = connected && !!code && !busy

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Text style={{ color: C.text, fontSize: 17, ...font(800) }}>Pair a laptop</Text>
      <Text style={{ color: C.muted, fontSize: 14, lineHeight: 20, ...font(500) }}>
        On the laptop, run "bun run pair". Type the six-digit code it shows. The code works once, for five minutes.
      </Text>
      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder="418 902"
        placeholderTextColor={C.muted}
        keyboardType="number-pad"
        maxLength={7}
        accessibilityLabel="Pairing code"
        style={{
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
          backgroundColor: C.surface,
          color: C.text,
          fontSize: 24,
          letterSpacing: 6,
          textAlign: 'center',
          ...font(700),
        }}
      />
      <Pressable
        onPress={pair}
        disabled={!canPair}
        accessibilityRole="button"
        style={{
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
          backgroundColor: canPair ? C.primary : C.card,
        }}
      >
        <Text style={{ color: canPair ? '#FFFFFF' : C.muted, fontSize: 15, ...font(700) }}>
          {busy ? 'Pairing…' : 'Pair'}
        </Text>
      </Pressable>
      {!connected && (
        <Text style={{ color: C.muted, fontSize: 13, ...font(500) }}>Not connected to the Brain, so pairing is unavailable.</Text>
      )}
      {outcome && <Text style={{ color: C.text, fontSize: 14, ...font(600) }}>{outcome}</Text>}

      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 6 }} />
      <Text style={{ color: C.text, fontSize: 17, ...font(800) }}>Paired laptops</Text>
      {live.pairedDevices.length === 0 ? (
        <Text style={{ color: C.muted, fontSize: 14, ...font(500) }}>
          {connected ? 'No laptop is paired yet.' : 'Connect to the Brain to see paired laptops.'}
        </Text>
      ) : (
        live.pairedDevices.map((device) => {
          // A list kept from before the link dropped can't say who is online now.
          const online = connected && device.online
          return (
            <View
              key={device.device_id}
              accessible={true}
              accessibilityLabel={`${device.name}: ${online ? 'online' : connected ? 'offline' : 'status unknown'}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 12,
                padding: 14,
                backgroundColor: C.card,
              }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: online ? C.green : connected ? C.danger : C.muted }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 15, ...font(700) }}>{device.name}</Text>
                <Text style={{ color: C.muted, fontSize: 12, ...font(500) }}>
                  {online ? 'Online' : connected ? 'Offline' : 'Status unknown'} · paired {new Date(device.paired_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          )
        })
      )}
    </ScrollView>
  )
}
