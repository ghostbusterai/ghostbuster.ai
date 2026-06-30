import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

/** Dev: `/` so http://localhost:5173/ works. Build: `./` so assets load as `./assets/...` when served by the API (Render) or `vite preview`. */
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
  preview: {
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: true },
      "/compose": { target: "http://127.0.0.1:3001", changeOrigin: true },
    },
  },
}))
