import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"
import { fileURLToPath } from "url"
import { spawn } from "child_process"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_DIR = path.resolve(__dirname, "../ghostbuster-server")

async function isApiListening() {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 1200)
    const r = await fetch("http://127.0.0.1:3001/api/health", { signal: ctrl.signal })
    clearTimeout(t)
    return r.ok
  } catch {
    return false
  }
}

/** Dev: start ghostbuster-server on :3001 if it is not already up. */
function ghostbusterApiPlugin() {
  /** @type {import('child_process').ChildProcess | null} */
  let apiChild = null

  function stopApi() {
    if (apiChild && !apiChild.killed) {
      try {
        apiChild.kill()
      } catch {
        /* ignore */
      }
      apiChild = null
    }
  }

  return {
    name: "ghostbuster-api-dev",
    apply: "serve",
    async configureServer() {
      if (await isApiListening()) {
        console.log("\n  [ghostbuster] API already on http://127.0.0.1:3001\n")
        return
      }

      const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm"
      apiChild = spawn(npmCmd, ["start"], {
        cwd: SERVER_DIR,
        stdio: "inherit",
        shell: true,
        env: { ...process.env, PORT: "3001" },
      })

      apiChild.on("error", (err) => {
        console.error("\n  [ghostbuster] Could not start API:", err.message)
        console.error("  Run manually: cd ghostbuster-server && npm start\n")
      })

      const deadline = Date.now() + 20000
      while (Date.now() < deadline) {
        // eslint-disable-next-line no-await-in-loop
        if (await isApiListening()) {
          console.log("\n  [ghostbuster] API ready at http://127.0.0.1:3001\n")
          break
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 400))
      }

      process.on("SIGINT", stopApi)
      process.on("SIGTERM", stopApi)
      process.on("exit", stopApi)
    },
  }
}

/** Dev: `/` so http://localhost:5173/ works. Build: `./` for static deploy via the API. */
export default defineConfig(({ command }) => ({
  base: command === "build" ? "./" : "/",
  plugins: [react(), command === "serve" ? ghostbusterApiPlugin() : null].filter(Boolean),
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