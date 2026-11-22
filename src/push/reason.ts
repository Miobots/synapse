/**
 * Why this app can't receive approval pushes, or undefined when it can (BRAIN_DECISIONS 28).
 * Pure, so the rules are tested without a phone. Every reason is plain words for the Devices screen.
 */
export function pushUnavailableReason(env: {
  isDevice: boolean
  inExpoGo: boolean
  platform: string
  projectId?: string
  permission: 'granted' | 'denied' | 'undetermined'
}): string | undefined {
  if (env.platform !== 'android' && env.platform !== 'ios') return 'Notifications work on a phone only.'
  if (!env.isDevice) return 'Notifications need a real phone, not an emulator.'
  // Expo removed remote push from Expo Go on Android in SDK 53.
  if (env.inExpoGo && env.platform === 'android') return 'Notifications need the installed app; Expo Go cannot receive them on Android.'
  if (!env.projectId) return "Notifications aren't set up yet (this build has no Expo project ID)."
  if (env.permission !== 'granted') return 'Notifications are turned off for this app in the phone settings.'
  return undefined
}
