// My Calendar — iPhone Widget (Scriptable) v2
// Shows today's schedule + tasks from Firebase Firestore.
// Calendar names/colors are read live from the app's "Manage calendars" —
// rename or recolor there and the widget follows automatically.
//
// SETUP: paste the same projectId and apiKey you used in index.html below.

const PROJECT_ID = "past-paper-tracker-51a18";
const API_KEY    = "AIzaSyBWQTbyCFJxLsypcyVIK5gC4-KeXnxXfEw";

const FALLBACK_COLOR = "#9A9A97";

// ---------- Firestore REST ----------
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function parseVal(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(parseVal);
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
    let url = `${BASE}/${col}?pageSize=300&key=${API_KEY}` + (token ? `&pageToken=${encodeURIComponent(token)}` : "");
    const j = await new Request(url).loadJSON();
    if (j.error) throw new Error(col + ": " + j.error.message);
    docs = docs.concat(j.documents || []);
    token = j.nextPageToken;
  } while (token);
  return docs.map(parseDoc);
}

// ---------- Date helpers ----------
const now = new Date();
function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
const TODAY = ymd(now), DOW = now.getDay();
function toMin(t) { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fmtTime(t) {
  if (!t) return "";
  let [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + (m ? ":" + String(m).padStart(2, "0") : "") + ap;
}

// ---------- Data ----------
async function getData() {
  const [events, tasks, cats] = await Promise.all([
    fetchAll("cal_events"), fetchAll("cal_tasks"), fetchAll("cal_categories")
  ]);
  const catColor = {};
  for (const c of cats) catColor[c.id] = c.color || FALLBACK_COLOR;
  const occurs = e => e.recurring
    ? (e.dayOfWeek === DOW && (!e.date || TODAY >= e.date) && (!e.until || TODAY <= e.until) && !(e.exdates || []).includes(TODAY))
    : e.date === TODAY;
  const todayAll = events.filter(occurs);
  const allDayEvents = todayAll.filter(e => e.allDay);
  const todayEvents = todayAll.filter(e => !e.allDay).sort((a, b) => toMin(a.start) - toMin(b.start));
  const openTasks = tasks
    .filter(t => !t.done && t.dueDate && t.dueDate <= TODAY)
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  return { allDayEvents, todayEvents, openTasks, catColor };
}

// ---------- Widget ----------
const TEXT    = Color.dynamic(new Color("#1F1F1F"), new Color("#F2F2F2"));
const SUBTEXT = Color.dynamic(new Color("#8A8884"), new Color("#9C9A96"));
const RED     = new Color("#EB5757");

async function buildWidget() {
  const w = new ListWidget();
  w.backgroundColor = Color.dynamic(new Color("#FFFFFF"), new Color("#1E1E1E"));
  w.setPadding(14, 15, 12, 15);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

  const isLarge = config.widgetFamily === "large";
  const MAX_EVENTS = isLarge ? 6 : 3;
  const MAX_TASKS  = isLarge ? 5 : 2;

  const head = w.addStack();
  head.centerAlignContent();
  const dayName = head.addText(now.toLocaleDateString("en-US", { weekday: "long" }));
  dayName.font = Font.boldSystemFont(13);
  dayName.textColor = RED;
  head.addSpacer(6);
  const dateTxt = head.addText(now.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  dateTxt.font = Font.mediumSystemFont(13);
  dateTxt.textColor = SUBTEXT;
  head.addSpacer();
  w.addSpacer(8);

  let data, error = null;
  try { data = await getData(); } catch (e) { error = e.message; }

  if (error) {
    const t = w.addText("⚠️ " + error);
    t.font = Font.systemFont(11);
    t.textColor = SUBTEXT;
    return w;
  }

  const { allDayEvents, todayEvents, openTasks, catColor } = data;
  const colorOf = e => new Color(catColor[e.category] || FALLBACK_COLOR);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // All-day / deadline banner
  for (const e of allDayEvents.slice(0, isLarge ? 3 : 2)) {
    const row = w.addStack();
    row.centerAlignContent();
    const flag = row.addText(e.deadline ? "⚑" : "▪");
    flag.font = Font.systemFont(11);
    flag.textColor = colorOf(e);
    row.addSpacer(6);
    const title = row.addText(e.title);
    title.font = Font.semiboldSystemFont(12);
    title.textColor = TEXT;
    title.lineLimit = 1;
    row.addSpacer();
    w.addSpacer(5);
  }
  if (allDayEvents.length) w.addSpacer(3);

  if (!todayEvents.length) {
    const t = w.addText("No events today 🎉");
    t.font = Font.systemFont(12);
    t.textColor = SUBTEXT;
  }
  for (const e of todayEvents.slice(0, MAX_EVENTS)) {
    const past = (toMin(e.end) || toMin(e.start) + 60) < nowMin;
    const row = w.addStack();
    row.centerAlignContent();
    const bar = row.addStack();
    bar.size = new Size(3, 14);
    bar.cornerRadius = 1.5;
    const base = colorOf(e);
    bar.backgroundColor = past ? new Color(catColor[e.category] || FALLBACK_COLOR, 0.35) : base;
    row.addSpacer(7);
    const time = row.addText(fmtTime(e.start));
    time.font = Font.mediumSystemFont(11);
    time.textColor = past ? SUBTEXT : TEXT;
    time.textOpacity = past ? 0.6 : 0.85;
    row.addSpacer(6);
    const title = row.addText(e.title);
    title.font = past ? Font.systemFont(12) : Font.semiboldSystemFont(12);
    title.textColor = past ? SUBTEXT : TEXT;
    title.lineLimit = 1;
    row.addSpacer();
    w.addSpacer(5);
  }
  if (todayEvents.length > MAX_EVENTS) {
    const t = w.addText("+" + (todayEvents.length - MAX_EVENTS) + " more");
    t.font = Font.systemFont(10);
    t.textColor = SUBTEXT;
    w.addSpacer(3);
  }

  if (openTasks.length) {
    w.addSpacer(6);
    const lab = w.addText("TASKS");
    lab.font = Font.semiboldSystemFont(9);
    lab.textColor = SUBTEXT;
    w.addSpacer(4);
    for (const t of openTasks.slice(0, MAX_TASKS)) {
      const overdue = t.dueDate < TODAY;
      const row = w.addStack();
      row.centerAlignContent();
      const circ = row.addText("◯");
      circ.font = Font.systemFont(10);
      circ.textColor = overdue ? RED : new Color(catColor[t.category] || FALLBACK_COLOR);
      row.addSpacer(7);
      const title = row.addText(t.title);
      title.font = Font.systemFont(12);
      title.textColor = TEXT;
      title.lineLimit = 1;
      if (overdue) {
        row.addSpacer(5);
        const o = row.addText("overdue");
        o.font = Font.mediumSystemFont(9);
        o.textColor = RED;
      }
      row.addSpacer();
      w.addSpacer(4);
    }
    if (openTasks.length > MAX_TASKS) {
      const t = w.addText("+" + (openTasks.length - MAX_TASKS) + " more tasks");
      t.font = Font.systemFont(10);
      t.textColor = SUBTEXT;
    }
  }

  w.addSpacer();
  return w;
}

const widget = await buildWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
