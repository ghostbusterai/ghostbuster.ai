# GhostBuster (local run)
Website: https://ghostbuster-ai-js5l.onrender.com/

Two apps: **`ghostbuster-server`** (Express API) and **`GhostBuster`** (Vite + React). Run both for full functionality.

Data is stored in a single JSON file on the API machine: `ghostbuster-server/data/app-data.json` (no accounts or sign-in).

## User testing via URL (no install for testers)

**Goal:** Testers open the website link in a browser and use the app. They do **not** clone the repo or run Node.

**Live site:** https://ghostbuster-ai-js5l.onrender.com/

The app is deployed as **one Render web service** (`render.yaml`). On each deploy, Render:

1. Installs and starts `ghostbuster-server`
2. Runs `npm run build` there, which builds `GhostBuster/dist/`
3. Serves the React UI and API from the same origin

**Deploy / update**

Push to `main` on GitHub. Render redeploys automatically when the repo is connected.

**Environment variables** (Render dashboard, not in git):

- `ANTHROPIC_API_KEY` — optional; required for **Compose** AI drafts
- `PORT` — set by Render

**Send to testers**

*"Open **https://ghostbuster-ai-js5l.onrender.com/** and try the app."*

No separate static host or GitHub Pages deploy is needed. The UI talks to `/api` on the same origin unless you override `VITE_API_BASE` at build time.

## Prerequisites

- Node.js 18+ and npm

## One-time setup

```bash
cd ghostbuster-server
cp .env.example .env
# Edit .env — ANTHROPIC_API_KEY for AI compose
npm install

cd ../GhostBuster
cp .env.example .env   # optional; only needed if overriding VITE_API_BASE
npm install
```

## Run (developer machine)

**Terminal 1 — API**

```bash
cd ghostbuster-server
npm start
```

**Terminal 2 — UI**

```bash
cd GhostBuster
npm run dev
```

Open **http://localhost:5173**. The dev server proxies `/api` and `/compose` to the API on port **3001**.

## Let someone test from another device

### Same Wi‑Fi / LAN

1. Find your machine's LAN IP (macOS: **System Settings → Network**, or `ipconfig getifaddr en0`).
2. Keep both terminals running.
3. On another device, open **`http://<that-ip>:5173`** (not `localhost`).
4. Allow port **5173** through the firewall if prompted.

The API listens on `0.0.0.0`; Vite uses `host: true` for LAN access. Everyone hitting your machine shares the same `app-data.json`.

### They run it on their own computer

Share this repo (zip or Git). They follow **One-time setup** and **Run** above. Their data lives in `ghostbuster-server/data/app-data.json` on their machine.

### Over the public internet

Use the Render deployment in **[User testing via URL](#user-testing-via-url-no-install-for-testers)**. Tunnels (ngrok, Cloudflare Tunnel) work for quick demos if you accept shared data on your machine.
