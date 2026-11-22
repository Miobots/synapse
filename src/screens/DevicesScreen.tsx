import { useCallback, useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, Switch } from 'react-native'
import { Topics, type AuditView } from '@miobots/protocol'
import { auditLine, chainBanner } from '../approvals/format'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import type { LiveLink } from '../capabilities/hooks'
import { pairingCode } from '../pairing/code'

/**
 * Pair a laptop (S9.2). The laptop shows a six-digit code after `bun run pair`; typing it here is
 * what lets the Brain issue that laptop its own token. Finding a laptop on the network never is.
 */
export function DevicesScreen({ live, pushStatus }: { live: LiveLink; pushStatus: string }) {
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

  // The kill switch (S5.3): its state is the Brain's, shown from `sys.devices`, never assumed here.
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState<string>()
  const laptopAccess = !live.killswitchActive
  const setLaptopAccess = useCallback(async (allow: boolean) => {
    setSwitching(true)
    setSwitchError(undefined)
    const result = await command(Topics.SYS_KILLSWITCH, { active: !allow })
    setSwitching(false)
    if (result.status !== 'accepted') setSwitchError(result.reason ?? 'The Brain said no.')
  }, [command])

  // The activity log (S5.2) is fetched every time and kept only while this screen shows it: a copy
  // of a tamper-evident log defeats its purpose.
  const [log, setLog] = useState<AuditView>()
  const [logError, setLogError] = useState<string>()
  const loadLog = useCallback(async () => {
    setLogError(undefined)
    const result = await command(Topics.SYS_AUDIT, { limit: 50 })
    if (result.status === 'accepted' && result.audit) setLog(result.audit)
    else {
      setLog(undefined)
      setLogError(result.status === 'accepted' ? 'The Brain sent no log.' : result.reason ?? "The activity log isn't available.")
    }
  }, [command])
  useEffect(() => {
    if (connected) void loadLog()
    else setLog(undefined)
  }, [connected, loadLog, live.killswitchActive])

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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 17, ...font(800) }}>Laptop access</Text>
          <Text style={{ color: live.killswitchActive ? C.danger : C.muted, fontSize: 14, lineHeight: 20, ...font(600) }}>
            {!connected
              ? "Can't reach the Brain, so this can't be changed right now."
              : live.killswitchActive
                ? 'Switched off: Mio can\'t use any laptop, and laptops can\'t connect.'
                : 'On: Mio may use your paired laptops. Actions still need your tap.'}
          </Text>
        </View>
        <Switch
          value={connected ? laptopAccess : false}
          onValueChange={setLaptopAccess}
          disabled={!connected || switching}
          accessibilityLabel="Laptop access"
        />
      </View>
      {switchError && <Text style={{ color: C.danger, fontSize: 13, ...font(600) }}>{switchError}</Text>}

      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 6 }} />
      <Text style={{ color: C.text, fontSize: 17, ...font(800) }}>Approval notifications</Text>
      <Text style={{ color: C.muted, fontSize: 14, lineHeight: 20, ...font(500) }}>{pushStatus}</Text>

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

      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 6 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, color: C.text, fontSize: 17, ...font(800) }}>Activity log</Text>
        <Pressable onPress={loadLog} disabled={!connected} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: connected ? C.primary : C.muted, fontSize: 14, ...font(700) }}>Refresh</Text>
        </Pressable>
      </View>
      {!connected ? (
        <Text style={{ color: C.muted, fontSize: 14, ...font(500) }}>Connect to the Brain to see what Mio did on your laptop.</Text>
      ) : logError ? (
        <Text style={{ color: C.muted, fontSize: 14, ...font(500) }}>{logError}</Text>
      ) : !log ? (
        <Text style={{ color: C.muted, fontSize: 14, ...font(500) }}>Loading…</Text>
      ) : (
        <>
          <Text style={{ color: log.chain.ok ? C.green : C.danger, fontSize: 14, lineHeight: 20, ...font(700) }}>{chainBanner(log.chain)}</Text>
          {log.entries.length === 0 && <Text style={{ color: C.muted, fontSize: 14, ...font(500) }}>Nothing yet.</Text>}
          {log.entries.map((entry) => {
            const line = auditLine(entry)
            const bad = !log.chain.ok && log.chain.first_bad_id !== undefined && entry.id >= log.chain.first_bad_id
            return (
              <View key={entry.id} style={{ borderWidth: 1, borderColor: bad ? C.danger : C.border, borderRadius: 12, padding: 12, backgroundColor: C.card, gap: 2 }}>
                <Text style={{ color: C.text, fontSize: 14, ...font(700) }}>{line.title}</Text>
                <Text style={{ color: C.muted, fontSize: 12, ...font(500) }}>
                  #{entry.id} · {new Date(entry.at_ms).toLocaleString()} · {line.detail}
                </Text>
              </View>
            )
          })}
        </>
      )}
    </ScrollView>
  )
}
