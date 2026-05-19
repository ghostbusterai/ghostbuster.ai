# GhostBuster (local run)

Two apps: **`ghostbuster-server`** (Express API) and **`GhostBuster`** (Vite + React). Run both for full functionality.

## User testing via URL (no install for testers)

**Goal:** Testers only open a **https://…** link in a browser, **sign up / sign in**, and use the app. They do **not** clone the repo or run Node.

**You** (organizer) deploy two pieces once:

| Piece | What it is | Examples |
|-------|------------|----------|
| **API** | Node server (`ghostbuster-server`) | [Render](https://render.com), [Railway](https://railway.app), [Fly.io](https://fly.io), any VPS |
| **Web app** | Static files from `GhostBuster` after `npm run build` → upload `dist/` | [Netlify](https://netlify.com), [Vercel](https://vercel.com), [Cloudflare Pages](https://pages.cloudflare.com), GitHub Pages |

**1. Deploy the API**

- Set the host’s environment variables (dashboard, not in git):
  - `SUPABASE_URL` — same as in Supabase → Project Settings → API
  - `SUPABASE_SERVICE_ROLE_KEY` — **service_role** key (server only)
  - `ANTHROPIC_API_KEY` — optional; required for **Compose** AI drafts
  - `PORT` — usually set automatically by the platform (or use their default)
- Start command: `npm start` in `ghostbuster-server` (after `npm install`).
- Note the **public HTTPS origin** of the API, e.g. `https://ghostbuster-api.onrender.com` (no trailing slash).

**2. Build the web app with the right env (important)**

Vite bakes these in at **build** time:

```bash
cd GhostBuster
export VITE_API_BASE=https://your-api.example.com    # exactly your deployed API origin
export VITE_SUPABASE_URL=https://xxxxx.supabase.co
export VITE_SUPABASE_ANON_KEY=eyJ...                   # anon key from Supabase
npm install
npm run build
```

Upload the contents of **`GhostBuster/dist/`** to your static host. Note the **public HTTPS origin** of the site, e.g. `https://ghostbuster.netlify.app`.

**3. Configure Supabase for that URL**

In Supabase → **Authentication** → **URL Configuration**:

- **Site URL** — your **frontend** URL (e.g. `https://ghostbuster.netlify.app`).
- **Redirect URLs** — add the same URL (and `http://localhost:5173` if you still test locally). Password reset and OAuth rely on this.

**4. Send to testers**

One message is enough: *“Open **https://your-frontend…**, create an account, and try the flows below.”* No repo, no env files for them.

**5. Operational notes**

- If you change the API URL, **rebuild** the frontend with a new `VITE_API_BASE` and redeploy `dist/`.
- The **anon** key in the built JS is expected; the **service_role** key must stay only on the server.
- This app uses in-memory tab navigation (no React Router paths), so static hosting does not need special SPA fallback rules for routes.

---

## Modes

| Mode | When | Data |
|------|------|------|
| **Legacy** | `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are **not** set on the API, and **`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`** are **not** set in the UI | One JSON file: `ghostbuster-server/data/app-data.json` (no accounts) |
| **Multi-user (recommended for testers)** | Supabase env vars set on **both** API and UI (see below) | PostgreSQL in your Supabase project, isolated per user |

The frontend and API **must agree**: if the UI shows sign-in, the API must have Supabase keys. If only one side is configured, requests will fail with 401 or confusing errors.

## Prerequisites

- Node.js 18+ and npm
- For multi-user mode: a free [Supabase](https://supabase.com) project

## One-time setup

```bash
cd ghostbuster-server
cp .env.example .env
# Edit .env — ANTHROPIC_API_KEY for AI compose; add Supabase keys for multi-user (see below)
npm install

cd ../GhostBuster
cp .env.example .env
npm install
```

### Multi-user: Supabase project

1. Create a project in Supabase → **SQL Editor** → paste and run `supabase/migrations/001_initial_schema.sql` from this repo (run once).
2. **Authentication → Providers → Email** — for quick demos, disable **Confirm email** so sign-up logs users in immediately.
3. **Project Settings → API**: copy **Project URL** and **anon public** key → `GhostBuster/.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Copy **service_role** key (secret) → `ghostbuster-server/.env` as `SUPABASE_SERVICE_ROLE_KEY`, and the same **Project URL** as `SUPABASE_URL`.  
   **Never** put the service role key in the React app or commit it to git.

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

Open **http://localhost:5173** (or the URL Vite prints). The dev server proxies `/api` and `/compose` to the API on port **3001**.

In **multi-user** mode, you’ll get a **Sign in / Create account** screen first; each account has its own contacts, reminders, logs, and updates.

## Let someone test from another device

### Same Wi‑Fi / LAN

1. On the machine running the stack, find its LAN IP (macOS: **System Settings → Network**, or run `ipconfig getifaddr en0`).
2. Keep **Terminal 1** and **Terminal 2** running.
3. On the tester’s phone or laptop, open **`http://<that-ip>:5173`** (replace `<that-ip>` with the LAN IP; don’t use `localhost` on the other device).
4. Allow incoming connections on port **5173** if the OS firewall prompts you. (Testers only need the Vite URL; it proxies API traffic to the API on your machine.)

The API already listens on `0.0.0.0`; Vite is configured with `host: true` so the UI is reachable on the LAN. In **multi-user** mode, give testers the same Supabase-backed build (or repo + `.env`) so they can **create their own account**; their data stays in **their** Supabase user row, not on your laptop’s JSON file.

### They run it on their own computer

Share this repo (zip or Git). They follow **One-time setup** and **Run** above.

- **Legacy:** their data lives in `ghostbuster-server/data/app-data.json` on their machine.
- **Multi-user:** they add the same Supabase URL/keys (or a **fork** of your Supabase project / their own project after running the SQL migration). They sign up with **their** email; data is in the cloud under **their** account.

### Over the public internet

Use **[User testing via URL (no install for testers)](#user-testing-via-url-no-install-for-testers)** above (deploy API + static `dist/` with `VITE_API_BASE` and Supabase URL config). Tunnels (ngrok, Cloudflare Tunnel) are an alternative only if you trust everyone with access to your machine and keys.
