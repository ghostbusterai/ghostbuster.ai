# GhostBuster Autofill (Chrome extension)

Fills job applications from the user's GhostBuster autofill profile, on any site the user allows. It follows
a job from its posting to the real application form. It clicks "Apply"-style buttons along the way, but it
never clicks Next, Submit, or Easy Apply. The user reviews every application and submits it themselves.

## Load it locally

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `ghostbuster-extension/` folder. After pulling changes, click the reload icon on the extension card.
3. Refresh GhostBuster. The Applications page shows **Fill** buttons once it detects the extension.
4. Optional: in the extension popup, choose a résumé to attach automatically. It stays in the browser and is never uploaded to GhostBuster.

## Permissions

- **Workday, Greenhouse, Lever, and Ashby** work as soon as the extension is installed.
- **Every other site** (company careers pages, LinkedIn, iCIMS, SmartRecruiters, and so on) is an optional permission. The user grants it in one of three ways:
  - When a job they opened from GhostBuster first lands on that site, a small window asks **Allow on this site** / **Allow on all sites** / **Not now**.
  - **Allow on all sites** is also available in the extension popup and on GhostBuster's Applications page.
  - The popup's **Fill this page** button fills just the current tab. It uses `activeTab` and needs no standing permission.
- **Removing access**: the popup's **Remove access** revokes every optional site permission.
- **Install warning**: `webNavigation` lets the extension follow a job across redirects, new tabs, and iframes. Because of it, Chrome warns at install that the extension can "read your browsing history". The extension only acts on tabs opened from GhostBuster, or where the user clicks Fill.

## How it works

- **GhostBuster page → extension.** `app-bridge.js` runs on the GhostBuster app. It only activates when the page has `<meta name="ghostbuster-app">`. It relays `window.postMessage` traffic to `background.js`, and keeps a copy of the autofill profile so **Fill this page** works anywhere.
- **Tracking the job.** `background.js` opens the job and remembers which GhostBuster application the tab belongs to. The job carries over into tabs opened from that tab. `filler.js` is injected into each page and frame the job reaches, wherever the user has granted access.
- **Following Apply buttons.** On a posting page with no form, `filler.js` clicks an exact "Apply"-style button (for example Apply, Apply now, Apply for this job, Application, or Workday's Apply Manually). It caps this at six clicks per job. On Workday sign-in pages it asks the user to sign in, then keeps going.
- **Filling the form.** On the form, it fills profile fields and attaches the résumé. A review panel lists:
  - **Needs your answer**: required written questions. GhostBuster marks the application and creates a reminder.
  - **Check before submitting**: dropdowns and other choices it couldn't answer from the profile.
- **Reporting results.** **I reviewed it** and **I submitted it** report back to GhostBuster. If the GhostBuster tab was closed, results wait in the extension until GhostBuster is open again.

## App URLs

`manifest.json` matches `localhost`, `127.0.0.1`, and `*.onrender.com` for the GhostBuster app. If the app moves to a custom domain, add it to the first `content_scripts` entry.

## Known limits

- **Custom dropdowns are not filled.** This covers Workday's dropdown buttons and Greenhouse's react-select comboboxes. They are listed for the user instead.
- **Untested here:**
  - Workday end to end, because it needs a candidate account.
  - The permission prompt flow inside a real Chrome install.
