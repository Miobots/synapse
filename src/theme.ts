export type Theme = typeof DARK

export const DARK = {
  bg: '#080C18',
  surface: '#0F1628',
  card: '#141C30',
  border: '#1E2A44',
  primary: '#FF6B47',
  cyan: '#00D4FF',
  violet: '#A78BFA',
  green: '#34D399',
  yellow: '#FCD34D',
  text: '#F0F4FF',
  muted: '#6B7A99',
  danger: '#FF3B5C',
}

export const LIGHT = {
  bg: '#F0F4FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  border: '#DDE3EE',
  primary: '#FF6B47',
  cyan: '#0099BB',
  violet: '#6D28D9',
  green: '#059669',
  yellow: '#D97706',
  text: '#0F172A',
  muted: '#64748B',
  danger: '#DC2626',
}

// Font helpers — map weight to loaded Inter variant
export const font = (weight: 400 | 500 | 600 | 700 | 800 | 900) => {
  const map: Record<number, string> = {
    400: 'Inter_400Regular',
    500: 'Inter_500Medium',
    600: 'Inter_600SemiBold',
    700: 'Inter_700Bold',
    800: 'Inter_800ExtraBold',
    900: 'Inter_900Black',
  }
  return { fontFamily: map[weight] }
}
