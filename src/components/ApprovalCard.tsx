import { useEffect, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTheme } from '../context/ThemeContext'
import { font } from '../theme'
import type { LiveLink } from '../capabilities/hooks'
import { argumentLines, secondsLeft } from '../approvals/format'

/**
 * S5.1 — "Mio wants to …", with the exact arguments, a countdown, and Reject / Approve.
 *
 * This tap is the only way a laptop action is ever approved: voice may announce the request, but
 * the answer has to come from this token-holding app (BRAIN_DECISIONS 27).
 */
export function ApprovalCard({ live }: { live: LiveLink }) {
  const { theme: C } = useTheme()
  const [now, setNow] = useState(() => Date.now())
  const pending = live.approvals.filter((approval) => secondsLeft(approval.expires_at, now) !== undefined)
  const current = pending[0]

  useEffect(() => {
    if (!current) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [current])

  if (!current) return null
  const left = secondsLeft(current.expires_at, now)

  const answer = (approve: boolean) => live.answerApproval(current.approval_id, approve)

  return (
    <View
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 96,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: C.surface,
        padding: 16,
        gap: 8,
      }}
    >
      <Text style={{ color: C.text, fontSize: 16, ...font(800) }}>Mio wants to use your laptop</Text>
      <Text style={{ color: C.muted, fontSize: 13, ...font(600) }}>Tool: {current.tool_name}</Text>
      {argumentLines(current.args).map((line) => (
        <Text key={line} style={{ color: C.text, fontSize: 14, fontFamily: 'monospace' }}>{line}</Text>
      ))}
      <Text style={{ color: C.muted, fontSize: 12, ...font(500) }}>
        Expires in {left}s{pending.length > 1 ? ` · ${pending.length - 1} more waiting` : ''}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <Pressable
          onPress={() => answer(false)}
          accessibilityRole="button"
          style={{ flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: C.card }}
        >
          <Text style={{ color: C.text, fontSize: 15, ...font(700) }}>Reject</Text>
        </Pressable>
        <Pressable
          onPress={() => answer(true)}
          accessibilityRole="button"
          style={{ flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: C.primary }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 15, ...font(700) }}>Approve</Text>
        </Pressable>
      </View>
    </View>
  )
}
