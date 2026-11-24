// My Calendar — iPhone Widget (Scriptable) v3
// Works in every widget size:
//   Small   → what's on now / next, plus your nearest deadline countdown
//   Medium  → Today on the left, the next few days on the right
//   Large   → deadlines + a 7-day agenda + today's tasks
//   Lock Screen (rectangular / inline / circular) → next event or deadline
// Tapping opens the calendar on that day; the ＋ (medium/large) opens "New event".
// Works offline: if there's no signal it shows the last data it loaded.
//
// Optional: long-press the widget → Edit Widget → Parameter → type a number
// (e.g. 5) to change how many days ahead it looks.

const PROJECT_ID = "past-paper-tracker-51a18";
const API_KEY    = "AIzaSyBWQTbyCFJxLsypcyVIK5gC4-KeXnxXfEw";
const APP_URL    = "https://mekawy801.github.io/my-calendar/";

const FALLBACK_COLOR = "#9A9A97";
const USE_24H = false;

// ---------- Firestore REST ----------
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function parseVal(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(parseVal);
  if (v.nullValue !== undefined) return null;
  return null;
}
function parseDoc(doc) {
  const out = { id: doc.name.split("/").pop() };
  for (const [k, v] of Object.entries(doc.fields || {})) out[k] = parseVal(v);
  return out;
}
async function fetchAll(col) {
  let docs = [], token = null;
  do {
    const url = `${BASE}/${col}?pageSize=300&key=${API_KEY}` + (token ? `&pageToken=${encodeURIComponent(token)}` : "");
    const req = new Request(url);
    req.timeoutInterval = 12;
    const j = await req.loadJSON();
    if (j.error) throw new Error(col + ": " + j.error.message);
    docs = docs.concat(j.documents || []);
    token = j.nextPageToken;
  } while (token);
  return docs.map(parseDoc);
}

// ---------- Offline cache ----------
const fm = FileManager.local();
const CACHE = fm.joinPath(fm.documentsDirectory(), "my-calendar-cache.json");
async function loadData() {
  try {
    const [events, tasks, cats] = await Promise.all([fetchAll("cal_events"), fetchAll("cal_tasks"), fetchAll("cal_categories")]);
    const data = { events, tasks, cats, savedAt: Date.now() };
    fm.writeString(CACHE, JSON.stringify(data));
    return { ...data, offline: false };
  } catch (e) {
    if (fm.fileExists(CACHE)) return { ...JSON.parse(fm.readString(CACHE)), offline: true };
    throw e;
  }
}

// ---------- Date helpers ----------
const now = new Date();
function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function parseYmd(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const TODAY = ymd(now);
const NOW_MIN = now.getHours() * 60 + now.getMinutes();
function toMin(t) { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function endMin(e) { return toMin(e.end) || toMin(e.start) + 60; }
function fmtTime(t) {
  if (!t) return "";
  let [h, m] = t.split(":").map(Number);
  if (USE_24H) return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + (m ? ":" + String(m).padStart(2, "0") : "") + ap;
}
function dayLabel(ds) {
  const diff = Math.round((parseYmd(ds) - parseYmd(TODAY)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return parseYmd(ds).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}
function daysLeft(ds) { return Math.round((parseYmd(ds) - parseYmd(TODAY)) / 86400000); }
function countdown(ds) { const n = daysLeft(ds); return n === 0 ? "today" : n === 1 ? "tomorrow" : n + "d left"; }
function untilText(min) {
  const d = min - NOW_MIN;
  if (d <= 0) return "now";
  if (d < 60) return "in " + d + " min";
  const h = Math.floor(d / 60), m = d % 60;
  return "in " + h + "h" + (m ? " " + m + "m" : "");
}

// ---------- Data shaping ----------
function occursOn(e, ds) {
  const dow = parseYmd(ds).getDay();
  if (e.recurring) return e.dayOfWeek === dow && (!e.date || ds >= e.date) && (!e.until || ds <= e.until) && !(e.exdates || []).includes(ds);
  return e.date === ds;
}
function shape(raw, lookahead) {
  const catColor = {};
  for (const c of raw.cats) catColor[c.id] = c.color || FALLBACK_COLOR;
  const days = [];
  for (let i = 0; i < lookahead; i++) {
    const ds = ymd(addDays(now, i));
    const evs = raw.events.filter(e => occursOn(e, ds));
    days.push({
      ds,
      allDay: evs.filter(e => e.allDay),
      timed: evs.filter(e => !e.allDay).sort((a, b) => toMin(a.start) - toMin(b.start))
    });
  }
  // Deadlines with a countdown, next 60 days (one-off events only)
  const deadlines = raw.events
    .filter(e => e.allDay && e.deadline && !e.recurring && e.date >= TODAY && daysLeft(e.date) <= 60)
    .sort((a, b) => a.date.localeCompare(b.date));
  const tasks = raw.tasks
    .filter(t => !t.done && t.dueDate && t.dueDate <= TODAY)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const today = days[0];
  const current = today.timed.find(e => toMin(e.start) <= NOW_MIN && endMin(e) > NOW_MIN);
  const upcomingToday = today.timed.filter(e => toMin(e.start) > NOW_MIN);
  const remainingToday = today.timed.filter(e => endMin(e) > NOW_MIN);
  // Next event (today or later days)
  let next = upcomingToday[0] ? { e: upcomingToday[0], ds: TODAY } : null;
  if (!next) for (const d of days.slice(1)) if (d.timed[0]) { next = { e: d.timed[0], ds: d.ds }; break; }
  return { days, deadlines, tasks, current, next, remainingToday, catColor, offline: raw.offline, savedAt: raw.savedAt };
}

// ---------- Styling ----------
const TEXT    = Color.dynamic(new Color("#1F1F1F"), new Color("#F2F2F2"));
const SUBTEXT = Color.dynamic(new Color("#8A8884"), new Color("#9C9A96"));
const RED     = new Color("#EB5757");
const ACCENT  = new Color("#2383E2");
const BG      = Color.dynamic(new Color("#FFFFFF"), new Color("#1E1E1E"));
const colorOf = (d, e) => new Color(d.catColor[e.category] || FALLBACK_COLOR);
const link = ds => APP_URL + "#date=" + ds;

function txt(stack, s, font, color, opts = {}) {
  const t = stack.addText(s);
  t.font = font; t.textColor = color;
  if (opts.lines !== undefined) t.lineLimit = opts.lines;
  if (opts.opacity !== undefined) t.textOpacity = opts.opacity;
  if (opts.shrink) t.minimumScaleFactor = opts.shrink;
  return t;
}
function bar(stack, color, h = 14) {
  const b = stack.addStack();
  b.size = new Size(3, h); b.cornerRadius = 1.5; b.backgroundColor = color;
  return b;
}
function header(w, d, withPlus) {
  const head = w.addStack();
  head.centerAlignContent();
  txt(head, now.toLocaleDateString("en-US", { weekday: "long" }), Font.boldSystemFont(13), RED);
  head.addSpacer(6);
  txt(head, now.toLocaleDateString("en-US", { month: "short", day: "numeric" }), Font.mediumSystemFont(13), SUBTEXT);
  if (d.offline) { head.addSpacer(6); txt(head, "offline", Font.mediumSystemFont(9), SUBTEXT, { opacity: 0.7 }); }
  head.addSpacer();
  if (withPlus) {
    const p = head.addStack();
    p.url = APP_URL + "#new";
    p.backgroundColor = ACCENT; p.cornerRadius = 9; p.size = new Size(18, 18); p.centerAlignContent();
    txt(p, "+", Font.boldSystemFont(14), Color.white());
  }
}
function eventRow(parent, d, e, opts = {}) {
  const past = opts.ds === TODAY && endMin(e) <= NOW_MIN;
  const isNow = opts.ds === TODAY && toMin(e.start) <= NOW_MIN && endMin(e) > NOW_MIN;
  const row = parent.addStack();
  row.centerAlignContent();
  bar(row, past ? new Color(d.catColor[e.category] || FALLBACK_COLOR, 0.35) : colorOf(d, e), opts.h || 14);
  row.addSpacer(6);
  const tcol = isNow ? RED : past ? SUBTEXT : TEXT;
  txt(row, isNow ? "now" : fmtTime(e.start), Font.mediumSystemFont(opts.small ? 10 : 11), tcol, { opacity: past ? 0.6 : 0.85 });
  row.addSpacer(5);
  txt(row, e.title, past ? Font.systemFont(opts.small ? 11 : 12) : Font.semiboldSystemFont(opts.small ? 11 : 12), past ? SUBTEXT : TEXT, { lines: 1 });
  row.addSpacer();
  return row;
}
function deadlineRow(parent, d, e, small) {
  const row = parent.addStack();
  row.centerAlignContent();
  txt(row, "⚑", Font.systemFont(small ? 10 : 11), colorOf(d, e));
  row.addSpacer(5);
  txt(row, e.title, Font.semiboldSystemFont(small ? 11 : 12), TEXT, { lines: 1 });
  row.addSpacer(4);
  txt(row, countdown(e.date), Font.mediumSystemFont(small ? 10 : 11), daysLeft(e.date) <= 3 ? RED : SUBTEXT);
  row.addSpacer();
  return row;
}

// ---------- Sizes ----------
function buildSmall(w, d) {
  w.url = link(TODAY);
  header(w, d, false);
  w.addSpacer(8);
  const focus = d.current ? { e: d.current, ds: TODAY, label: "NOW" } : d.next ? { ...d.next, label: d.next.ds === TODAY ? "NEXT · " + untilText(toMin(d.next.e.start)) : "NEXT · " + dayLabel(d.next.ds) } : null;
  if (focus) {
    txt(w, focus.label.toUpperCase(), Font.semiboldSystemFont(9), focus.label === "NOW" ? RED : SUBTEXT);
    w.addSpacer(3);
    const row = w.addStack();
    bar(row, colorOf(d, focus.e), 34);
    row.addSpacer(6);
    const col = row.addStack(); col.layoutVertically();
    txt(col, focus.e.title, Font.semiboldSystemFont(14), TEXT, { lines: 2, shrink: 0.8 });
    txt(col, fmtTime(focus.e.start) + (focus.e.end ? " – " + fmtTime(focus.e.end) : ""), Font.systemFont(11), SUBTEXT);
    const more = d.remainingToday.filter(e => e !== focus.e).length;
    if (more && focus.ds === TODAY) { w.addSpacer(4); txt(w, "+" + more + " more today", Font.systemFont(10), SUBTEXT); }
  } else {
    txt(w, "Nothing coming up 🎉", Font.systemFont(12), SUBTEXT);
  }
  w.addSpacer();
  if (d.deadlines[0]) deadlineRow(w, d, d.deadlines[0], true);
  else if (d.tasks.length) txt(w, "◯ " + d.tasks.length + " task" + (d.tasks.length > 1 ? "s" : "") + " due", Font.mediumSystemFont(10), d.tasks.some(t => t.dueDate < TODAY) ? RED : SUBTEXT);
}

function buildMedium(w, d) {
  w.url = link(TODAY);
  header(w, d, true);
  w.addSpacer(7);
  const cols = w.addStack();
  cols.topAlignContent();

  // Left: today (finished events hidden so the rest fits)
  const left = cols.addStack();
  left.layoutVertically(); left.size = new Size(136, 0); left.url = link(TODAY);
  const today = d.days[0];
  for (const e of today.allDay.slice(0, 1)) { e.deadline ? deadlineRow(left, d, e, true) : eventRow(left, d, { ...e, start: "" }, { ds: TODAY, small: true }); left.addSpacer(4); }
  const shown = d.remainingToday.slice(0, today.allDay.length ? 4 : 5);
  if (!shown.length) txt(left, today.timed.length ? "All done for today ✓" : "Free today 🎉", Font.systemFont(11), SUBTEXT);
  for (const e of shown) { eventRow(left, d, e, { ds: TODAY, small: true }); left.addSpacer(4); }
  const extra = d.remainingToday.length - shown.length;
  if (extra > 0) txt(left, "+" + extra + " more", Font.systemFont(9), SUBTEXT);
  const lastDay = d.days[d.days.length - 1].ds;
  const farDl = d.deadlines.find(e => e.date > lastDay);
  if (farDl) { left.addSpacer(2); deadlineRow(left, d, farDl, true).url = link(farDl.date); left.addSpacer(2); }
  if (d.tasks.length) { left.addSpacer(2); txt(left, "◯ " + d.tasks.length + " task" + (d.tasks.length > 1 ? "s" : ""), Font.mediumSystemFont(9), d.tasks.some(t => t.dueDate < TODAY) ? RED : SUBTEXT); }
  left.addSpacer();

  cols.addSpacer(10);
  const div = cols.addStack(); div.size = new Size(1, 112); div.backgroundColor = new Color("#8A8884", 0.18);
  cols.addSpacer(10);

  // Right: the next days
  const right = cols.addStack();
  right.layoutVertically(); right.size = new Size(136, 0);
  let lines = 0; const MAX = 6;
  for (const day of d.days.slice(1)) {
    const items = day.allDay.concat(day.timed);
    if (!items.length) continue;
    if (lines >= MAX - 1) break;
    const block = right.addStack(); block.layoutVertically(); block.url = link(day.ds);
    txt(block, dayLabel(day.ds).toUpperCase(), Font.semiboldSystemFont(9), SUBTEXT);
    block.addSpacer(2); lines++;
    for (const e of items) {
      if (lines >= MAX) break;
      if (e.allDay) e.deadline ? deadlineRow(block, d, e, true) : eventRow(block, d, { ...e, start: "" }, { ds: day.ds, small: true });
      else eventRow(block, d, e, { ds: day.ds, small: true });
      block.addSpacer(3); lines++;
    }
    right.addSpacer(3);
  }
  if (!lines) txt(right, "Nothing in the next few days", Font.systemFont(11), SUBTEXT);
  right.addSpacer();
}

function buildLarge(w, d) {
  w.url = link(TODAY);
  header(w, d, true);
  w.addSpacer(8);
  if (d.deadlines.length) {
    for (const e of d.deadlines.slice(0, 2)) { const r = deadlineRow(w, d, e); r.url = link(e.date); w.addSpacer(4); }
    w.addSpacer(4);
  }
  let lines = 0;
  const MAX = 13 - Math.min(2, d.deadlines.length) - (d.tasks.length ? Math.min(3, d.tasks.length) + 1 : 0);
  for (const day of d.days) {
    const items = day.ds === TODAY ? day.allDay.filter(e => !e.deadline).concat(d.remainingToday) : day.allDay.filter(e => !e.deadline).concat(day.timed);
    if (!items.length && day.ds !== TODAY) continue;
    if (lines >= MAX - 1) break;
    const block = w.addStack(); block.layoutVertically(); block.url = link(day.ds);
    txt(block, dayLabel(day.ds).toUpperCase(), Font.semiboldSystemFont(9), day.ds === TODAY ? RED : SUBTEXT);
    block.addSpacer(3); lines++;
    if (!items.length) { txt(block, "Nothing left today", Font.systemFont(11), SUBTEXT); block.addSpacer(3); lines++; }
    for (const e of items) {
      if (lines >= MAX) break;
      eventRow(block, d, e.allDay ? { ...e, start: "" } : e, { ds: day.ds });
      block.addSpacer(4); lines++;
    }
    w.addSpacer(4);
  }
  if (d.tasks.length) {
    w.addSpacer(2);
    txt(w, "TASKS", Font.semiboldSystemFont(9), SUBTEXT);
    w.addSpacer(3);
    for (const t of d.tasks.slice(0, 3)) {
      const row = w.addStack(); row.centerAlignContent();
      const overdue = t.dueDate < TODAY;
      txt(row, "◯", Font.systemFont(10), overdue ? RED : new Color(d.catColor[t.category] || FALLBACK_COLOR));
      row.addSpacer(6);
      txt(row, t.title, Font.systemFont(12), TEXT, { lines: 1 });
      if (overdue) { row.addSpacer(5); txt(row, "overdue", Font.mediumSystemFont(9), RED); }
      row.addSpacer();
      w.addSpacer(3);
    }
  }
  w.addSpacer();
}

function buildRect(w, d) {
  w.url = link(TODAY);
  const f = d.current ? { e: d.current, top: "Now · until " + fmtTime(d.current.end) }
          : d.next ? { e: d.next.e, top: (d.next.ds === TODAY ? untilText(toMin(d.next.e.start)) : dayLabel(d.next.ds)) + " · " + fmtTime(d.next.e.start) } : null;
  if (f) {
    txt(w, f.top, Font.mediumSystemFont(11), Color.white(), { opacity: 0.8 });
    txt(w, f.e.title, Font.semiboldSystemFont(14), Color.white(), { lines: 1 });
  } else txt(w, "No events coming up", Font.mediumSystemFont(12), Color.white());
  if (d.deadlines[0]) txt(w, "⚑ " + d.deadlines[0].title + " · " + countdown(d.deadlines[0].date), Font.systemFont(11), Color.white(), { lines: 1, opacity: 0.8 });
}
function buildInline(w, d) {
  const e = d.current || (d.next && d.next.e);
  const t = d.current ? "Now: " + e.title
          : d.next ? fmtTime(e.start) + (d.next.ds === TODAY ? "" : " " + dayLabel(d.next.ds)) + " " + e.title
          : d.deadlines[0] ? d.deadlines[0].title + " · " + countdown(d.deadlines[0].date) : "Free";
  txt(w, "🗓 " + t, Font.systemFont(12), Color.white());
}
function buildCircular(w, d) {
  const dl = d.deadlines[0];
  w.addSpacer();
  if (dl) {
    const n = daysLeft(dl.date);
    const a = txt(w, String(n), Font.boldRoundedSystemFont(20), Color.white()); a.centerAlignText();
    const b = txt(w, n === 1 ? "day" : "days", Font.systemFont(9), Color.white(), { opacity: 0.8 }); b.centerAlignText();
    w.url = link(dl.date);
  } else {
    const a = txt(w, String(d.remainingToday.length), Font.boldRoundedSystemFont(20), Color.white()); a.centerAlignText();
    const b = txt(w, "left", Font.systemFont(9), Color.white(), { opacity: 0.8 }); b.centerAlignText();
    w.url = link(TODAY);
  }
  w.addSpacer();
}

// ---------- Build ----------
async function buildWidget(family) {
  const w = new ListWidget();
  const accessory = family.startsWith("accessory");
  if (!accessory) { w.backgroundColor = BG; w.setPadding(13, 14, 11, 14); }

  const param = parseInt(args.widgetParameter, 10);
  const lookahead = param > 0 ? Math.min(14, param) : family === "large" ? 7 : 4;

  let d;
  try { d = shape(await loadData(), lookahead); }
  catch (e) {
    txt(w, "⚠️ " + e.message, Font.systemFont(11), accessory ? Color.white() : SUBTEXT);
    return w;
  }

  // Refresh at the next event boundary (start or end) or in 15 min, whichever is sooner
  const bounds = d.days[0].timed.flatMap(e => [toMin(e.start), endMin(e)]).filter(m => m > NOW_MIN);
  const nextBound = bounds.length ? Math.min(...bounds) : Infinity;
  const mins = Math.max(1, Math.min(15, nextBound - NOW_MIN));
  w.refreshAfterDate = new Date(Date.now() + mins * 60000);

  if (family === "small") buildSmall(w, d);
  else if (family === "large" || family === "extraLarge") buildLarge(w, d);
  else if (family === "accessoryRectangular") buildRect(w, d);
  else if (family === "accessoryInline") buildInline(w, d);
  else if (family === "accessoryCircular") buildCircular(w, d);
  else buildMedium(w, d);
  return w;
}

if (config.runsInWidget) {
  Script.setWidget(await buildWidget(config.widgetFamily || "medium"));
} else {
  // Running inside Scriptable: pick a size to preview
  const a = new Alert();
  a.title = "Preview widget";
  ["Small", "Medium", "Large", "Lock Screen (rectangular)"].forEach(x => a.addAction(x));
  a.addCancelAction("Cancel");
  const i = await a.presentSheet();
  if (i === 0) await (await buildWidget("small")).presentSmall();
  else if (i === 1) await (await buildWidget("medium")).presentMedium();
  else if (i === 2) await (await buildWidget("large")).presentLarge();
  else if (i === 3) await (await buildWidget("accessoryRectangular")).presentAccessoryRectangular();
}
Script.complete();
