import React from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import { ThemeProvider } from "./ThemeContext"
import { applyTheme } from "./theme"
import { readPreferences } from "./preferences"
import "./theme.css"

applyTheme(readPreferences().colorScheme)

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
