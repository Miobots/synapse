import { createContext, useContext, useState, type ReactNode } from 'react'
import { DARK, LIGHT, type Theme } from '../theme'

interface ThemeCtx {
  theme: Theme
  isDark: boolean
  setIsDark: (v: boolean) => void
}

const Ctx = createContext<ThemeCtx>({ theme: DARK, isDark: true, setIsDark: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true)
  return (
    <Ctx.Provider value={{ theme: isDark ? DARK : LIGHT, isDark, setIsDark }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTheme() {
  return useContext(Ctx)
}
