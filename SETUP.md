# My Calendar — Setup Guide

Three files:

| File | What it is |
|---|---|
| `index.html` | The full calendar app (Mac) |
| `widget.js` | The iPhone home-screen / lock-screen widget (Scriptable) |
| `manifest.json`, `icon-*.png` | Let the app install on your iPhone Home Screen |
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

4. **Firestore rules:** the calendar is locked to your teacher account (the same `isTeacher()` used by the tracker rules). In **Firestore Database → Rules**, the calendar lines are:

```
match /cal_events/{doc}     { allow read, write: if isTeacher(); }
match /cal_tasks/{doc}      { allow read, write: if isTeacher(); }
match /cal_categories/{doc} { allow read, write: if isTeacher(); }
```

Click **Publish**. The app asks you to sign in once per device (tracker teacher email + password) and remembers it; the widget does the same once in Scriptable.

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

## Step 3½ — The calendar on your iPhone

Open **https://mekawy801.github.io/my-calendar/** in Safari → Share → **Add to Home Screen**. It opens full-screen with its own icon, like a real app.

On a phone the app switches to phone mode automatically:

| Do this | To |
|---|---|
| Swipe left / right | Move through days |
| **3D** button | Switch between 1, 2 or 3 days on screen |
| Tap an event | Open / edit it |
| Long-press empty space | Create an event there (keep dragging down to make it longer) |
| Long-press an event, then drag | Move it (hold at the screen edge to jump to the next day) |
| Long-press an event's bottom edge, then drag | Change its end time |
| ☰ | Slide out the mini calendar, calendars and tasks |
| ＋ (bottom right) | New event |

Links the widget uses (you can use them in Shortcuts too):
`…/my-calendar/#date=2026-12-01` opens that day, `#new` opens a new event, `#new=2026-12-01` a new event on that day, `#month` the month view.

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

Done. Each size shows something different:

- **Small** — what's on now (or next, with "in 40 min"), plus your nearest deadline countdown
- **Medium** — today on the left, the next few days on the right, a ＋ to add an event
- **Large** — deadlines, a 7-day agenda, and overdue/today tasks
- **Lock Screen** (rectangular, inline, circular) — next event, or days left to your next deadline

Tapping a day opens the calendar on that day. If there's no signal, it shows the last data it loaded (marked "offline").
To look further ahead, long-press the widget → Edit Widget → **Parameter** → type a number of days (e.g. `7`).

iOS refreshes widgets on its own schedule — the script asks for a refresh when the current event ends or the next one starts (at most every 15 min). Running the script in Scriptable lets you preview every size.

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
