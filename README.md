# Alex Launcher — Installable PWA

A fun, motivating personal-growth dashboard (habits, Pomodoro focus timer, study goals, notes, gamified XP) — installable on your phone or laptop like a real app, with Firebase login and cloud sync.

## 📁 File structure

```
alex-launcher-pwa/
├── index.html              ← the app shell (HTML only)
├── manifest.json           ← PWA metadata (name, icons, colors, install behavior)
├── sw.js                   ← service worker (offline caching)
├── README.md                ← this file
├── css/
│   └── styles.css          ← all styling
├── js/
│   ├── firebase-config.js  ← 🔑 YOUR Firebase project keys go here (only file you must edit)
│   └── app.js               ← all app logic (state, rendering, Firebase auth/sync, PWA install)
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    ├── icon-maskable-192.png
    ├── icon-maskable-512.png
    ├── apple-touch-icon.png
    └── favicon-32.png
```

Keep this folder structure exactly as-is — the files reference each other by these relative paths.

---

## ▶️ 1. Run it locally

PWAs need to be served over `http(s)://`, not opened directly as a `file://` — the service worker and manifest won't work otherwise. Any of these work:

**Option A — Python (already on most machines)**
```bash
cd alex-launcher-pwa
python3 -m http.server 8080
```
Open **http://localhost:8080**

**Option B — Node**
```bash
cd alex-launcher-pwa
npx serve .
```

**Option C — VS Code**
Install the "Live Server" extension → right-click `index.html` → "Open with Live Server".

Without any Firebase setup, the app already works fully — it just runs in **local demo mode** (no login screen, nothing persists after a refresh). That's intentional so you can try it immediately.

---

## 🔥 2. Firebase setup (for login + cloud save)

This is what makes data (habits, notes, goals, pomodoro sessions, XP) survive a refresh / follow you across devices.

1. Go to **https://console.firebase.google.com** → **Add project** (the free Spark plan is enough).
2. In your project: **⚙️ Project settings → General → Your apps → Add app → Web (`</>`)** → register it → copy the config object it shows you.
3. Open **`js/firebase-config.js`** and paste your values in, replacing the placeholders:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
4. Left sidebar → **Build → Authentication → Get started → Sign-in method** tab → enable **Email/Password**.
5. Left sidebar → **Build → Firestore Database → Create database** → start in **test mode** to begin (switch to the production rules below before sharing the app publicly).
6. Refresh the app — you'll now see a real Login / Sign Up screen, and everything you do gets saved to `users/{yourUserId}` in Firestore.

### Recommended Firestore security rules (production)
Test mode allows anyone to read/write anything — fine for development, not for a public app. Once you're ready, go to **Firestore Database → Rules** and use:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
This means each signed-in user can only read/write their own document — nobody else's.

### What's synced
Habits, notes, study goals, Pomodoro session presets & completed-session count, XP/level, which dashboard widgets are shown/hidden, and dark/light theme. Calendar tasks and the statistics charts are still demo/mock data in this version.

---

## 🌐 3. Deploy it (so it's installable from a real URL, not just localhost)

PWAs can only be installed from an **HTTPS** URL (localhost is the one exception, for testing). Easiest free options:

**Firebase Hosting (recommended, same project as your data)**
```bash
npm install -g firebase-tools
firebase login
cd alex-launcher-pwa
firebase init hosting   # choose your existing project, public dir = "." , single-page app = No
firebase deploy
```
You'll get a URL like `https://your-project.web.app`.

**Netlify** — drag-and-drop the whole `alex-launcher-pwa` folder onto https://app.netlify.com/drop.

**GitHub Pages** — push the folder to a repo, enable Pages on the `main` branch.

---

## 📲 4. Install it as an app

- **Android (Chrome)** — open the deployed URL → tap the **⬇️ Install** pill in the app's top bar (appears automatically once the browser detects it's installable), or Chrome's menu → "Add to Home screen / Install app".
- **iPhone/iPad (Safari)** — open the URL → Share button → **Add to Home Screen** (iOS doesn't support the automatic install prompt, this is the standard way).
- **Desktop (Chrome/Edge)** — open the URL → an install icon appears in the address bar, or use the in-app **⬇️ Install** button.

Once installed it opens in its own window (no browser bar), works offline for the interface itself (thanks to `sw.js` caching the app shell), and — because `manifest.json` sets `"orientation": "landscape"` — will default to a landscape layout on phones, matching the launcher's landscape-first design.

---

## 🧩 Feature summary

**Home** — flip clock, greeting, mascot with rotating expressions, XP bar, dashboard grid (each tile has a ⋮ menu → remove / open its settings), Today's Goal, Habits mini-list, Start Focus button.

**Dashboard tile shortcuts**
- 🍅 Pomodoro → add/remove custom focus-session presets (name + minutes)
- ✅ Habits → add / edit / delete habits
- 📚 Study Hrs → add goals with target hours, log progress
- 📝 Notes → open Notes panel

**Navigation** — swipe left/right for Calendar/Statistics, swipe up for App Drawer, swipe down for Quick Settings. Desktop: arrow keys + Esc.

**Quick Settings** — Wi-Fi/Bluetooth/Flashlight toggles (UI only — a browser can't control real hardware), brightness/volume sliders, battery info, and your account email + **Log Out**.

**Gamification** — XP for completing habits, finishing Pomodoros, logging study hours; leveling up triggers confetti.

---

## 🛠 Not yet built (ideas for next round)
- Offline write-queue for Firestore (currently: no connection = changes just don't save, no queued retry)
- Google/social login options
- Real device integrations (actual brightness/Wi-Fi/Bluetooth control needs a native app, not a PWA)
- Weight log, steps tracker, sleep tracker detail screens
- Unlockable wallpapers/themes/mascot outfits, achievement badges screen
- A true native Android launcher (this PWA can be installed and used like an app, but can't register as your phone's actual HOME launcher — that requires a native Kotlin app with a `HOME` intent-filter)

## 🐞 Troubleshooting
- **"My changes don't save after refresh"** → `js/firebase-config.js` still has placeholder values, or Firestore/Email-Password sign-in isn't enabled yet. See section 2.
- **Install button never appears** → the browser only offers install on HTTPS (or localhost) and only after it judges the manifest+service worker are valid; give it a few seconds, and check your browser's console for manifest/service-worker errors.
- **Blank white icon after install** → make sure the whole `icons/` folder was deployed alongside the other files.
