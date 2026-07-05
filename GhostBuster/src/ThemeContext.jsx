import React, { createContext, useContext, useEffect, useState } from "react"
import { applyTheme } from "./theme"
import { readPreferences, savePreferences } from "./preferences"

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [colorScheme, setColorSchemeState] = useState(() => readPreferences().colorScheme)

  useEffect(() => {
    applyTheme(colorScheme)
  }, [colorScheme])

  function setColorScheme(next) {
    savePreferences({ colorScheme: next })
    setColorSchemeState(next)
  }

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        setColorScheme,
        isLight: colorScheme === "light",
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return ctx
}
