# GhostBuster (local run)
Website: https://ghostbuster-ai-js5l.onrender.com/

## For application reviewers

You can try GhostBuster without a Google account. Google sign-in is limited to our approved beta testers, so reviewers use a demo account instead.

1. Open the demo link included in our application: **https://ghostbuster-ai-js5l.onrender.com/?demo=YOUR-CODE**. It signs you in directly.
2. Or open **https://ghostbuster-ai-js5l.onrender.com/**, click **Have a demo code? Try GhostBuster without Google**, and enter the access code: "app-reviewer".

Each visit creates a private demo account with sample data for a student, Alex Rivera: contacts, reminders, applications, and a résumé. Feel free to add, edit, and delete anything.

- **AI features** (message composer, résumé suggestions, Ghostwriter summaries) work, with a limited number of requests per demo account.
- **Gmail and Google Calendar** connections aren't available in demo accounts.
- **Demo accounts and their data** are deleted after 7 days.
- **The first load can take up to a minute** while the server wakes up.

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

**Environment variables** (Render dashboard → **Environment**):

| Variable | Required | Notes |
|----------|----------|--------|
| `ANTHROPIC_API_KEY` | For Compose AI | Optional otherwise |
| `MONGODB_URI` | For multi-user + Google sign-in | If unset, the app runs in **legacy single-user mode** (JSON file storage, no Google login) |
| `SESSION_SECRET` | Recommended in production | Long random string for session cookies |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | For Google sign-in + Calendar/Gmail | Only when `MONGODB_URI` is set |
| `DEMO_ACCESS_CODE` | For reviewer demo accounts | Enables demo sign-in without Google. Share `/?demo=<code>` links. Requires `MONGODB_URI` |
| `DEMO_AI_LIMIT` | No | AI requests per demo account (default 15) |
| `DEMO_TTL_DAYS` | No | Days before a demo account is deleted (default 7) |

`PORT`, `APP_URL`, and Google redirect URIs are set in `render.yaml`.

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
