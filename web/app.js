import { Soundscape } from "./audio.js";
import { Reef } from "./reef.js";

const $ = (id) => document.getElementById(id);
const desktop = !!window.mygo;
if (!desktop) document.querySelectorAll(".desktop-only").forEach(el => el.hidden = true);
let state = null;
let selectedKind = "focus";
let busy = false;
let compact = false;
let connectionHealthy = false;
let soundSession = null;
let soundPlaying = false;
let lastAudioKey = "";
let adjustingVolume = false;
let toastTimer;
const reef = new Reef($("ocean"));
const sound = new Soundscape((message, error) => {
  $("sound-status").textContent = message;
  if (error) toast(message);
});

function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").hidden = true, 5500);
}

async function call(method, ...args) {
  if (desktop) return window.mygo.call(method, ...args);
  const response = await fetch("/rpc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, args }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "操作暂时失败，请重试。");
  return data;
}

function connected(healthy) {
  connectionHealthy = healthy;
  document.body.classList.toggle("offline", !healthy);
  $("connection").textContent = healthy ? "安静陪伴中" : "连接中断 · 已静音";
  $("primary").disabled = !healthy || busy;
  $("sound-toggle").disabled = !healthy || busy;
  if (!healthy) { soundPlaying = false; lastAudioKey = ""; void sound.set(false, "waves", .35); }
}

function apply(next) {
  if (state && next.revision < state.revision) return;
  const previous = state;
  state = next;
  connected(true);
  const session = state.session;
  if (soundSession !== session.id) {
    // Loading an already-running timer must not autoplay on application start.
    soundPlaying = !!previous && session.status === "running" && session.kind === "focus" && state.preferences.soundEnabled;
    soundSession = session.id;
  } else if (previous && previous.session.status !== session.status) {
    if (session.status === "running") soundPlaying = session.kind === "focus" && state.preferences.soundEnabled;
    else soundPlaying = false;
  }
  if (!state.preferences.soundEnabled || session.status === "paused" || session.status === "complete") soundPlaying = false;
  if (previous && session.id === previous.session.id && session.status === "complete" && previous.session.status !== "complete") {
    if (state.preferences.chimeEnabled) sound.chime();
  }
  if (session.status === "running" || session.status === "paused") selectedKind = session.kind;
  else if (session.status === "complete") selectedKind = session.kind;
  render(previous);
  updateAudio();
}

function updateAudio() {
  if (!state) return;
  const p = state.preferences;
  const playing = soundPlaying && p.soundEnabled && connectionHealthy;
  const key = `${playing}:${p.sound}:${p.volume}`;
  if (key !== lastAudioKey) { lastAudioKey = key; void sound.set(playing, p.sound, p.volume); }
  $("sound-toggle").textContent = playing ? "关闭声音" : "开启声音";
  $("sound-toggle").setAttribute("aria-pressed", String(playing));
  $("compact-sound").style.opacity = playing ? "1" : ".5";
}

const formatTime = (ms) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

function render(previous) {
  const s = state.session, p = state.preferences;
  const active = s.status === "running" || s.status === "paused";
  const chosenDuration = (selectedKind === "focus" ? p.focusMinutes : p.breakMinutes) * 60000;
  const sameKind = s.kind === selectedKind;
  const duration = active || (s.status === "complete" && sameKind) ? s.durationMs : chosenDuration;
  const elapsed = active || (s.status === "complete" && sameKind) ? s.elapsedMs : 0;
  const time = formatTime(duration - elapsed);
  $("timer").textContent = time;
  $("compact-time").textContent = time;
  $("ring-progress").style.strokeDashoffset = String(559.2 * Math.min(1, elapsed / duration));
  const complete = s.status === "complete" && sameKind;
  $("timer-status").textContent = active ? (s.status === "paused" ? "暂停一下，没关系" : s.kind === "focus" ? "小鱼陪着你，慢慢来" : "离开屏幕，看看远处") : complete ? (s.kind === "focus" ? "专注完成 · 海底长大了" : "休息结束 · 欢迎回来") : "准备好，就开始";
  for (const kind of ["focus", "break"]) {
    $(kind + "-tab").classList.toggle("active", selectedKind === kind);
    $(kind + "-tab").setAttribute("aria-pressed", String(selectedKind === kind));
    $(kind + "-tab").disabled = active || busy;
  }
  $("task").disabled = active || selectedKind === "break" || busy;
  if (active && (!previous || s.id !== previous.session.id)) $("task").value = s.kind === "focus" ? s.task : "";
  $("task").placeholder = selectedKind === "break" ? "去喝杯水，让眼睛也休息一下" : "比如读几页书，写一小段代码";
  let label = selectedKind === "focus" ? "开始专注" : "开始休息", icon = "▶";
  if (active) { label = s.status === "running" ? "暂停一下" : "继续这一轮"; icon = s.status === "running" ? "Ⅱ" : "▶"; }
  else if (complete && s.kind === "focus") { label = "开始休息"; icon = "☕"; }
  else if (complete && s.kind === "break") { label = "开始下一轮"; }
  $("primary-label").textContent = label;
  $("primary-icon").textContent = icon;
  $("compact-primary").textContent = icon;
  $("compact-primary").setAttribute("aria-label", label);
  $("compact-primary").disabled = busy || !connectionHealthy;
  $("end").hidden = !active;
  $("end").disabled = busy;
  $("timer-footnote").textContent = active ? "中断也会记录时间，已有成长不会消失。" : "不着急，每一点专注都会留下痕迹。";
  $("feed").disabled = s.kind !== "break" || s.status !== "running" || state.fedSession === s.id || busy;
  $("feed").textContent = state.fedSession === s.id && s.kind === "break" ? "鱼儿吃饱啦" : "撒一点鱼食";
  $("growth-label").textContent = `${state.completed < 3 ? "初生" : state.completed < 12 ? "萌芽" : state.completed < 24 ? "繁盛" : "小小绿洲"} · ${state.completed} 轮专注`;
  $("next-growth").textContent = state.completed === 0 ? "完成一轮，长出第一株水草" : state.completed >= 24 ? "继续积累专注，认识更多海底朋友" : (state.completed % 3 === 0 ? "再一轮，海底会长出新植物" : "再一轮，水草会长高一些");
  $("reef-caption").lastElementChild.textContent = state.lastVisitor && complete && s.kind === "focus" ? `${state.lastVisitor}来做客了，已留在图鉴里。` : active && s.kind === "focus" ? "你专注做事，海底安静陪着你。" : active && s.kind === "break" ? "鱼儿不着急，你也可以休息一下。" : "一条鱼，一片海，等你慢慢来。";
  $("today-minutes").replaceChildren(document.createTextNode(String(Math.floor(state.todaySecs / 60))), unit(" 分钟"));
  $("today-rounds").replaceChildren(document.createTextNode(String(state.todayRounds)), unit(" 轮"));
  $("visitor-count").replaceChildren(document.createTextNode(String(state.visitors.length)), unit(" 位"));
  $("total-time").textContent = state.totalSecs ? `已经一起度过 ${Math.floor(state.totalSecs / 60)} 分钟，完成 ${state.completed} 轮专注。` : "你的海底，正在等待第一个故事。";
  $("notice").hidden = !state.notice;
  $("notice").textContent = state.notice;
  document.querySelectorAll("[data-sound]").forEach(button => { const selected = button.dataset.sound === p.sound; button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", String(selected)); button.disabled = busy; });
  if (!adjustingVolume && document.activeElement !== $("volume")) {
    $("volume").value = String(Math.round(p.volume * 100));
    $("volume-value").textContent = `${Math.round(p.volume * 100)}%`;
  }
  if (!previous || JSON.stringify(previous.visitors) !== JSON.stringify(state.visitors)) renderVisitors();
  if (!previous || JSON.stringify(previous.records) !== JSON.stringify(state.records)) renderRecords();
  reef.update(state);
  document.title = active ? `${time} · 小海底` : "小海底 · 桌面水族馆";
}

function unit(text) { const span = document.createElement("span"); span.textContent = text; return span; }
function renderVisitors() {
  if (!state.visitors.length) return;
  const icons = { clown: "🐠", tang: "🐟", angel: "🐠", puffer: "🐡" };
  $("visitors").replaceChildren(...state.visitors.map(v => {
    const el = document.createElement("div"); el.className = "visitor";
    const icon = document.createElement("span"); icon.textContent = icons[v.species] || "🐟"; icon.setAttribute("aria-hidden", "true");
    const info = document.createElement("div"), title = document.createElement("p"), date = document.createElement("small");
    title.textContent = v.name; date.textContent = `${new Date(v.date).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} · 来过 ${v.visits} 次`;
    info.append(title, date); el.append(icon, info); return el;
  }));
}
function renderRecords() {
  $("record-count").textContent = `${state.records.length} 条记录`;
  if (!state.records.length) return;
  $("records").replaceChildren(...state.records.slice(0, 30).map(r => {
    const el = document.createElement("div"); el.className = "record";
    const title = document.createElement("p"), meta = document.createElement("span");
    title.textContent = r.task || "一段安静的专注";
    meta.textContent = `${r.completed ? "完成" : "已记录"} · ${Math.floor(r.seconds / 60)}分${r.seconds % 60}秒 · ${new Date(r.date).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}`;
    el.append(title, meta); return el;
  }));
}

async function action(fn) {
  if (busy || !state || !connectionHealthy) return;
  busy = true; render(state);
  $("primary").disabled = true; $("sound-toggle").disabled = true;
  try { const next = await fn(); if (next) apply(next); }
  catch (error) { toast(error.message || "操作未完成，请稍后再试。"); }
  finally { busy = false; render(state); connected(connectionHealthy); }
}

function primary() {
  // Unlock during the user's gesture, including when ambience is muted.
  if (state?.preferences.chimeEnabled || state?.preferences.soundEnabled) void sound.unlock().catch(() => {});
  return action(async () => {
    const s = state.session;
    if (s.status === "running") return call("Aquarium.Pause");
    if (s.status === "paused") return call("Aquarium.Resume");
    let kind = selectedKind;
    if (s.status === "complete" && s.kind === selectedKind) kind = s.kind === "focus" ? "break" : "focus";
    return call("Aquarium.Start", kind, $("task").value);
  });
}

$("primary").onclick = primary;
$("compact-primary").onclick = primary;
for (const kind of ["focus", "break"]) $(kind + "-tab").onclick = () => { selectedKind = kind; render(state); };
$("end").onclick = () => $("end-dialog").showModal();
$("end-cancel").onclick = () => $("end-dialog").close();
$("end-confirm").onclick = () => { $("end-dialog").close(); void action(() => call("Aquarium.End")); };
$("feed").onclick = () => action(() => call("Aquarium.Feed"));
document.querySelectorAll("[data-sound]").forEach(button => button.onclick = () => {
  if (soundPlaying) void sound.unlock().catch(() => {});
  return action(() => call("Aquarium.SetPreferences", { ...state.preferences, sound: button.dataset.sound }));
});
// A range input never takes focus on mousedown in WKWebView, so the active
// element alone cannot tell that the user is adjusting: track the pointer.
$("volume").onpointerdown = () => { adjustingVolume = true; };
$("volume").oninput = () => {
  adjustingVolume = true;
  $("volume-value").textContent = `${$("volume").value}%`;
  if (soundPlaying) void sound.set(true, state.preferences.sound, Number($("volume").value) / 100);
};
$("volume").onchange = () => {
  // Read the chosen value before action() re-renders with the stored one.
  const volume = Number($("volume").value) / 100;
  return action(() => call("Aquarium.SetPreferences", { ...state.preferences, volume })).finally(() => { adjustingVolume = false; });
};
async function toggleSound() {
  if (busy || !state) return;
  const wanted = !soundPlaying;
  if (wanted) {
    try { await sound.unlock(); }
    catch (error) { toast(error.message); return; }
  }
  return action(async () => {
    const next = await call("Aquarium.SetPreferences", { ...state.preferences, soundEnabled: wanted });
    apply(next);
    // Preview while idle or on break is an explicit choice for this page.
    soundPlaying = wanted;
    lastAudioKey = "";
    updateAudio();
  });
}
$("sound-toggle").onclick = toggleSound;
$("compact-sound").onclick = toggleSound;
$("settings-open").onclick = () => {
  if (!state) return;
  $("focus-minutes").value = String(state.preferences.focusMinutes);
  $("break-minutes").value = String(state.preferences.breakMinutes);
  $("chime").checked = state.preferences.chimeEnabled;
  $("settings-dialog").showModal();
};
$("settings-close").onclick = () => $("settings-dialog").close();
// 更新窗口自己会说明结果：已是最新、发现新版本或检查失败。
$("check-update").onclick = () => { if (desktop) void call("Desktop.CheckForUpdates").catch(() => {}); };
$("settings-form").onsubmit = (event) => {
  event.preventDefault();
  if (!$("settings-form").reportValidity()) return;
  void action(async () => {
    const next = await call("Aquarium.SetPreferences", { ...state.preferences, focusMinutes: Number($("focus-minutes").value), breakMinutes: Number($("break-minutes").value), chimeEnabled: $("chime").checked });
    $("settings-dialog").close(); toast("设置已保存，时长从下一轮生效。"); return next;
  });
};
async function setCompact(value) {
  try {
    if (desktop) await call("Desktop.SetCompact", value);
    compact = value;
    document.body.classList.toggle("compact", compact);
    reef.resize();
  } catch (error) { toast(error.message); }
}
$("compact").onclick = () => setCompact(!compact);
$("expand").onclick = () => setCompact(false);
$("hide").onclick = () => call("Desktop.Hide").catch(error => toast(error.message));
$("quit").onclick = () => call("Desktop.Quit").catch(error => toast(error.message));
document.addEventListener("keydown", event => {
  if (event.code === "Space" && !event.repeat && !["INPUT", "BUTTON", "TEXTAREA", "SUMMARY"].includes(event.target.tagName) && !document.querySelector("dialog[open]")) { event.preventDefault(); void primary(); }
});
window.addEventListener("pagehide", () => sound.dispose());

async function start() {
  if (desktop) {
    window.mygo.on("aquarium:changed", apply);
    try { apply(await call("Aquarium.Get")); } catch (error) { connected(false); toast(error.message); }
  } else {
    const events = new EventSource("/events");
    events.onmessage = event => { try { apply(JSON.parse(event.data)); } catch { toast("水族馆状态暂时无法读取。"); } };
    events.onerror = () => connected(false);
    events.onopen = () => connected(true);
  }
}
void start();
