# My Calendar — Setup Guide

Three files:

| File | What it is |
|---|---|
| `index.html` | The full calendar app (Mac) |
| `widget.js` | The iPhone home-screen widget (Scriptable) |
| `SETUP.md` | This guide |

---

## Step 1 — Try it right now (30 seconds)

Double-click `index.html`. It opens in your browser and works immediately in **local mode** (data saved in that browser only). Add a few events and tasks to feel it out.

The iPhone widget needs the Firebase step below, because the widget and the Mac app must read the same database.

---

## Step 2 — Connect Firebase (reuse your Past Paper Tracker project)

You already have a Firebase project — we'll just add two new collections to it. Nothing about the tracker changes.

1. Go to https://console.firebase.google.com and open your existing project.
2. **Get your config:** click the gear ⚙️ → **Project settings** → scroll to **Your apps** → find the `firebaseConfig` block (apiKey, authDomain, projectId, ...).
3. Open `index.html` in a text editor, find this near the top of the `<script>` section, and paste your values:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

4. **Firestore rules:** in the console go to **Firestore Database → Rules** and add these two blocks inside `match /databases/{database}/documents { ... }`, next to your existing tracker rules:

```
match /cal_events/{doc} {
  allow read, write: if true;
}
match /cal_tasks/{doc} {
  allow read, write: if true;
}
match /cal_categories/{doc} {
  allow read, write: if true;
}
```

Click **Publish**.

> ⚠️ Like your tracker, `if true` means anyone who discovers your project ID could read/write these two collections. Fine for personal scheduling data, but don't put anything sensitive in event notes. We can lock it down with auth later if you want.

5. Reopen `index.html` — the top-right indicator should now say **Synced** (green dot) instead of **Local only**.

> If you added events in local mode first, just re-add them once after connecting — local data doesn't auto-migrate.

---

## Step 3 — Make it feel like a real Mac app (optional, recommended)

**Option A — Safari web app (nicest):**
1. Host it on GitHub Pages (below), open the URL in Safari.
2. Menu bar → **File → Add to Dock**.
3. You now have a dock icon that opens the calendar in its own window, no browser chrome. Exactly like a native app.

**Option B — GitHub Pages hosting** (same flow as your tracker). In Terminal:

```bash
cd ~/Desktop
mkdir my-calendar && cd my-calendar
# copy index.html into this folder first, then:
git init
git add index.html
git commit -m "My calendar app"
gh repo create my-calendar --public --source=. --push
```

Then on github.com → your `my-calendar` repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / root → **Save**. After a minute it's live at `https://mekawy801.github.io/my-calendar/`.

(If you don't have the `gh` CLI, create the repo on github.com and push with `git remote add origin ... && git push -u origin main` like you did for the tracker.)

---

## Step 4 — iPhone widget

1. Install **Scriptable** from the App Store (free).
2. Open Scriptable → tap **+** → paste the entire contents of `widget.js`.
3. At the top of the script, fill in:
   - `PROJECT_ID` → your Firebase project ID (from the same config)
   - `API_KEY` → your Firebase apiKey
4. Tap the script name at the top and rename it to `My Calendar`.
5. Tap ▶︎ Run — you should see a preview with today's events and tasks.
6. Add it to your home screen:
   - Long-press the home screen → tap **Edit** → **Add Widget** → search **Scriptable**
   - Pick the **Medium** size (or Large for more rows) → **Add Widget**
   - Long-press the new widget → **Edit Widget** → Script: **My Calendar** → When Interacting: **Open App** (or Run Script)

Done. The widget shows today's schedule with color bars per category, greys out finished events, and lists open + overdue tasks. iOS refreshes widgets on its own schedule — usually every 15–30 minutes. Tapping into Scriptable and running the script refreshes it instantly.

---

## How the pieces fit

```
index.html (Mac / any browser)
        ⇅ live sync
Firebase Firestore  ←  cal_events + cal_tasks + cal_categories
        ↓ read every ~15 min
widget.js (Scriptable widget on iPhone)
```

**Calendars (categories):** click the ✎ next to "Calendars" in the sidebar to add, rename, recolor (full color picker), or delete calendars. Changes sync to the database, so the iPhone widget picks up new names and colors automatically — no code edits ever.

**Settings (⚙︎ in the top bar):** theme (light / dark / match macOS), week start day, 12/24-hour time, drag snapping precision, default event length, column width, and the hour the day view opens at. All saved per device.

**The timeline:** scroll sideways freely through days — no fixed weeks, it keeps loading in both directions. Press-and-drag on empty space to create an event with exact times (e.g. 2:00–3:55), drag any block to move it between days or times, and drag its bottom edge to resize. Dragging a weekly repeating block moves only that day's occurrence; opening it and editing in the popup changes the whole series.

**Sidebar:** the ☰ button collapses/expands it.

**All-day & deadline events:** in the event popup, tick **All-day / deadline** — the time fields disappear and it shows as a chip pinned under the date instead of a timed block. Tick **show countdown** for deadlines (Hajj registration, exam dates) and the chip displays "12d left", counting down each day. These show in the day headers, in month view, and on the iPhone widget.

**Keyboard shortcuts (week view):**
- Single-click an event to select it, double-click to open it
- **⌘C / ⌘V** — copy a selected event, paste it wherever your cursor is (drops at that day and time)
- **⌘X** — cut (copy + remove), for moving an event to a far-off day without dragging
- **⌘D** — duplicate the selected event in place
- **⌘Z** — undo your last create, delete, move, paste, or duplicate
- **Delete / Backspace** — remove the selected event (one occurrence, if it repeats)
