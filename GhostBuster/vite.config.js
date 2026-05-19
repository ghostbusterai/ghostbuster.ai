import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

/** Dev: `/` so http://localhost:5173/ works. Build: `./` so assets load as `./assets/...` — works for `vite preview`, static `dist/`, and GitHub Pages at /ghostbuster.ai/. Absolute `/ghostbuster.ai/` breaks preview because files are in `dist/assets/`, not `dist/ghostbuster.ai/assets/`. */
export default defineConfig(({ command }) => ({
  base: command === "build" ? "./" : "/",
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/compose": { target: "http://127.0.0.1:3001", changeOrigin: true },
    },
  },
}))
