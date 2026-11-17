import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { isRunningInExpoGo } from 'expo'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { Topics } from '../protocol'
import type { LiveLink } from '../capabilities/hooks'
import { pushUnavailableReason } from './reason'

// In the foreground the approval card is already on screen; a banner on top would only repeat it.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
})

/**
 * Gives the Brain this phone's push token each time the link comes up, so an approval can reach
 * the phone when the app is closed (BRAIN_DECISIONS 28). Tapping the notification just opens the
 * app; on connect the Brain re-asks anything still waiting (G2.5). Returns a line for Devices.
 */
export function usePushRegistration(live: LiveLink): string {
  const [status, setStatus] = useState('Checking notifications…')
  const { command } = live

  useEffect(() => {
    if (live.status !== 'connected') return
    let cancelled = false
    void (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('approvals', {
            name: 'Approvals',
            importance: Notifications.AndroidImportance.MAX,
          })
        }
        let { status: permission } = await Notifications.getPermissionsAsync()
        if (permission === 'undetermined') permission = (await Notifications.requestPermissionsAsync()).status
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
        const reason = pushUnavailableReason({
          isDevice: Device.isDevice,
          inExpoGo: isRunningInExpoGo(),
          platform: Platform.OS,
          projectId,
          permission,
        })
        if (reason) {
          if (!cancelled) setStatus(`Off: ${reason}`)
          return
        }
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
        const result = await command(Topics.SYS_PUSH_TOKEN, { token, platform: Platform.OS as 'android' | 'ios' })
        if (cancelled) return
        setStatus(result.status === 'accepted'
          ? 'On: approvals reach this phone even when the app is closed (needs internet).'
          : `Off: the Brain didn't take this phone's address${result.reason ? `: ${result.reason}` : '.'}`)
      } catch (error) {
        if (!cancelled) setStatus(`Off: ${error instanceof Error ? error.message : 'could not set up notifications.'}`)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [live.status, command])

  return status
}
