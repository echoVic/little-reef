# 加入虾蟹，让海底生物更真实 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 6 种虾和 5 种蟹作为图鉴访客；所有生物照真实物种重画、按真实的发力方式运动；修好访客超过 4 位就报错的问题。

**Architecture:** `web/reef.js` 仍是场景：测量沙地和石头，按存档里的访客创建生物，把水草、石头和生物按远近一起排序绘制，并管理虾蟹轮换和喂食。生物由 `web/creatures/` 里的五套模型来画、来动：鱼、小虾、皮皮虾、螃蟹、寄居蟹。它们共用 `motion.js` 里的步态和作息，以及 `paint.js` 里的配色和轮廓工具。`species.js` 是物种表，也负责给图鉴画小画像。Go 端只扩充访客名单，并改成先遇见没见过的物种。

**Tech Stack:** Go 1.27（testing、embed）；Canvas 2D 与浏览器原生 ES 模块，不需要构建步骤，也不引入第三方库。验收时还会用到：本机 Google Chrome 加 chrome-devtools、Python 3（起静态服务器、造存档）、Node 22（只用 `node --check` 做语法检查）。这些都不提交。

**Spec:** `docs/superpowers/specs/2026-10-15-reef-creatures-design.md`

本计划里的全部代码都已经在临时克隆里按计划原样跑过：
- 改动前的 `reef.js` 在出现第 5 位访客时抛出 `TypeError: Cannot read properties of undefined (reading 'y')`。改动后，15 位访客同时在场，控制台也没有报错。
- 浏览器模式下，0 位、原有 4 位、全部 15 位访客三份存档都能正常显示，主窗口和挂件两种尺寸都看过。
- 2 倍像素密度下，16 只生物同时在场，平均每帧绘制约 0.55–0.58 毫秒，95% 的帧在 1.1 毫秒以内，远低于设计要求的 4 毫秒。
- 模拟喂食：鱼在水里吃掉约 7 粒，其余落到沙地，虾蟹再吃掉 3–5 粒，剩下的在 20 秒后淡出。
- 打开“减少动态效果”后，两次重画的位置完全一致，喂食时也不出现鱼食。
- Go 测试先失败（`a.roll undefined`），实现后通过，`go vet` 没有问题。

## 与设计文档的差异（规划时实测后的调整，请一并确认）

1. **任务顺序。** 设计里 Go 端排在第一。这里挪到前端之后（Task 8）：名单一扩充，用户就可能遇见新物种，前端得先认得它们。旧版 `reef.js` 遇到第 5 位访客就会报错。这样排，每个任务提交后程序都能正常运行。
2. **画风检查点挪到所有模型之后（Task 6）。** 五种鱼共用一套模型，一起调整更省事。规划时已经把 15 种都画了出来并截图核对过，检查点那一步请你一次看全。
3. **虾蟹画大了大约一半。** 按真实体长，主窗口里的清洁虾只有约 25 像素长，寄居蟹不到 20 像素，几乎看不清。物种表里虾蟹的体长取真实值的 1.3–1.5 倍（表上有注释），鱼保持真实比例。
4. **转身的画法。** 设计写的是整条鱼先缩短、再在另一侧展开。实测看起来像一张卡片在翻面，于是改成头先转过来、尾巴随后跟上，身体在中途对折，最短缩到原长的 16%。
5. **鱼吃几粒就饱。** 每条鱼每次只吃 2–3 粒，否则 12 粒全在水里被吃光，虾蟹永远等不到。鱼食也下沉得快了一些，大约 10 秒落到沙地，给虾蟹留出时间。
6. **住洞的虾受惊只是暂时躲回去。** 枪虾和皮皮虾被鱼吓到后，回洞里待 8–20 秒再出来，仍占着“在外活动”的名额，否则名额会越用越少。
7. **轮换时优先放出住得远的。** 避免几只虾蟹挤在同一块石头上。
8. **多一个文件 `web/creatures/paint.js`。** 里面是配色、轮廓、肢体、阴影和洞口这些画图工具，五套模型共用。
9. **花纹写在模型文件里。** `species.js` 只记录模型、体长、活动范围、性格和配色；各物种的花纹是画图代码，放在对应的模型里。
10. **箭蟹的“体长”按腿展算**（8 厘米）。它的身体只占腿展的三分之一左右。

## Global Constraints

- 前端不加构建步骤，不引入第三方库。新文件都是浏览器原生加载的 ES 模块，由现有的 `//go:embed web` 打进程序。
- 访客的物种 ID（写进存档，不能改）：`clown` `tang` `angel` `puffer` `cleaner` `fire` `harlequin` `pistol` `mantis` `slipper` `hermit` `emerald` `porcelain` `arrow` `swimmer`。常驻鱼的 ID `resident` 只在前端使用。
- 图鉴名依次是：小丑鱼、蓝吊鱼、神仙鱼、小河豚、清洁虾、火焰虾、油彩蜡膜虾、枪虾、皮皮虾、琵琶虾、寄居蟹、翡翠蟹、瓷蟹、箭蟹、梭子蟹。
- 第一轮必定遇见小丑鱼；之后每轮有三分之一的机会来访客，先来的是没见过的。提示文案、存档格式、`Visitor` 结构和 `bindings.ts` 都不变。
- 同一时间在外活动的虾蟹数为 floor(水缸宽度 / 120)，限制在 3 到 5 之间。轮换间隔 120–240 秒；最新来的访客始终在外面。
- 不用 canvas 的 `filter` 和 `shadowBlur`。帧率上限仍是每秒 24 帧，窗口隐藏或开启“减少动态效果”时只画一帧。
- `Reef` 对外接口不变：`new Reef(canvas)`、`resize()`、`update(state)`、`schedule()`、`draw()`。
- 用户可见文字用中文，代码注释用英文，风格与现有代码一致：双引号、分号、紧凑写法。
- Go 测试命令：`CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=4GiB GOFLAGS=-p=2 go test -p 2 -parallel 2 ./...`

## Review Focus

1. 访客超过 4 位不再报错，未知的物种 ID 会被跳过（Task 2 第 2、6 步）。
2. 鱼转身时头先转、尾巴后跟，不再瞬间翻面；同一深度的鱼彼此不穿过（Task 2 第 6 步）。
3. 虾蟹的腿着地时不打滑，步子左右交替；离开石头或回洞都有过程，不会凭空消失（Task 3–5）。
4. 在外的虾蟹数量始终不超过上限；被吓到的虾不会让名额变少（Task 5 第 4 步）。
5. 喂食：鱼吃 2–3 粒就不再追，剩下的落到沙地被虾蟹吃掉（Task 5 第 4 步）。
6. “减少动态效果”下画面稳定，没有喂食动画（Task 9 第 3 步）。
7. 第一轮遇见小丑鱼，之后先遇见没见过的；旧存档也能遇见新物种（Task 8）。

## 文件结构

- 新建 `web/creatures/paint.js`：配色（含远近雾化）、平滑轮廓、肢体、接触阴影、洞口。
- 新建 `web/creatures/motion.js`：随机与噪声、关节求解、步态 `Gait`，以及虾蟹共用的作息 `Crawler`（出门、回家、捡食、受惊）。
- 新建 `web/creatures/fish.js`：鱼的模型和五种鱼的样子（海金鱼、小丑鱼、蓝吊、神仙鱼、小河豚）。
- 新建 `web/creatures/species.js`：物种表、`create()`、`drawPortrait()`；模型注册表随任务逐步补全。
- 新建 `web/creatures/shrimp.js`：清洁虾、火焰虾、油彩蜡膜虾、枪虾（含洞口）、琵琶虾（从斜上方看）。
- 新建 `web/creatures/hermit.js`：寄居蟹。
- 新建 `web/creatures/crab.js`：翡翠蟹、瓷蟹、梭子蟹（斜上方正面），以及箭蟹（侧面）。
- 新建 `web/creatures/mantis.js`：皮皮虾（雀尾螳螂虾，住洞，在洞口探头）。
- 改写 `web/reef.js`：场景、远近排序、沙地纵深、石头（左边新增一组）、洞口、轮换、喂食。
- 修改 `web/app.js`、`web/style.css`：图鉴用小画像代替 emoji。
- 修改 `state.go`：15 种访客、可替换的随机函数、先遇见没见过的。
- 新建 `species_test.go`：名单、前后端一致、遇见顺序、旧存档。
- 修改 `README.md`：介绍、功能和测试覆盖范围。

## 验收工具（放在临时目录，不提交）

前端没有测试框架，这里的“测试”是浏览器里的验收页。验收页通过符号链接读取仓库里的 `web/`，所以仓库目录保持干净：

```bash
mkdir -p /tmp/reef-check/harness && ln -sfn "$PWD/web" /tmp/reef-check/web
# 把下面两个文件写进 /tmp/reef-check/harness/，然后：
python3 -m http.server 4180 --bind 127.0.0.1 --directory /tmp/reef-check
```

- `index.html?v=<物种,…>&g=<轮数>&sizes=<宽x高,…>`：按给定访客画出水缸，默认画主窗口（611×291）和挂件（400×266）两种尺寸。页面上有 `reefs`、`state`、`errors`，以及 `feed()`、`meet(id)`、`ff(秒)`（不画图快进）、`pause()`（停止自动播放）。加上 `&still` 就模拟“减少动态效果”。
- `index.html?gallery=<物种,…>&w=420&h=250`：用 `drawPortrait` 把每个物种画成大图。
- `turn.html?id=<鱼>`：第一行是一次转身的 8 个阶段，第二行是 8 个摆尾相位。

`/tmp/reef-check/harness/index.html`：

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>reef harness</title>
<style>
body{margin:0;background:#0c1820;color:#cfe;font:12px system-ui;padding:12px}
.stage{position:relative;overflow:hidden;background:radial-gradient(ellipse at 50% 0%,#194250 0%,#102e3a 55%,#0e252e 100%);display:inline-block;margin:6px;vertical-align:top}
.stage canvas{position:absolute;inset:0;width:100%;height:100%}
.ray{position:absolute;top:-70px;width:70px;height:420px;background:linear-gradient(#a6dbce18,#a6dbce00);transform:rotate(-27deg);filter:blur(9px);pointer-events:none}
.gallery{display:flex;flex-wrap:wrap;gap:8px}
.card{background:#1b3035;border-radius:10px;padding:6px}
.card canvas{display:block}
.card p{margin:4px 0 0;text-align:center}
</style></head><body>
<div id="root"></div>
<script type="module">
const q = new URLSearchParams(location.search);
if (q.has("still")) { const real = window.matchMedia; window.matchMedia = (m) => m.includes("reduced-motion") ? { matches: true, addEventListener() {} } : real(m); }
const { Reef } = await import("../web/reef.js");
const root = document.getElementById("root");
window.errors = [];
addEventListener("error", e => window.errors.push(String(e.message)));
if (q.has("gallery")) {
  const { SPECIES, drawPortrait } = await import("../web/creatures/species.js");
  const ids = q.get("gallery") ? q.get("gallery").split(",") : Object.keys(SPECIES);
  const w = +(q.get("w") || 300), h = +(q.get("h") || 180);
  const g = document.createElement("div"); g.className = "gallery"; root.append(g);
  for (const id of ids) { const card = document.createElement("div"); card.className = "card"; const cv = document.createElement("canvas"); cv.style.width = w + "px"; cv.style.height = h + "px"; const p = document.createElement("p"); p.textContent = id; card.append(cv, p); g.append(card); drawPortrait(cv, id); }
} else {
  const sizes = (q.get("sizes") || "611x291,400x266").split(",").map(s => s.split("x").map(Number));
  const visitors = (q.get("v") ?? "clown,tang,angel,puffer").split(",").filter(Boolean).map((species, i) => ({ species, name: species, date: `2026-10-${String(10 + i).padStart(2, "0")}T10:00:00+08:00`, visits: 1 }));
  const state = { completed: +(q.get("g") || 14), visitors, fedSession: 0 };
  window.reefs = [];
  for (const [w, h] of sizes) {
    const st = document.createElement("div"); st.className = "stage"; st.style.width = w + "px"; st.style.height = h + "px";
    st.innerHTML = '<div class="ray" style="left:12%"></div><div class="ray" style="left:46%;transform:rotate(-27deg) scaleX(.7)"></div>';
    const cv = document.createElement("canvas"); st.prepend(cv); root.append(st);
    const reef = new Reef(cv); window.reefs.push(reef);
    try { reef.update(structuredClone(state)); } catch (e) { window.errors.push(String(e)); }
  }
  window.state = state;
  window.feed = () => { state.fedSession = (state.fedSession || 0) + 1; for (const r of window.reefs) r.update(structuredClone(state)); };
  window.meet = (species) => { state.visitors.push({ species, name: species, date: `2026-10-${30}T1${state.visitors.length % 10}:00:00+08:00`, visits: 1 }); for (const r of window.reefs) r.update(structuredClone(state)); };
  // fast-forward: run the simulation for s seconds at 24 fps without drawing
  window.ff = (s) => { for (const r of window.reefs) { for (let i = 0; i < s * 24; i++) { r.time += 1 / 24; r.step(1 / 24); } r.draw(); } };
  window.pause = () => { for (const r of window.reefs) { cancelAnimationFrame(r.frame); r.frame = null; r.schedule = () => {}; } };
}
</script></body></html>
```

`/tmp/reef-check/harness/turn.html`：

```html
<!doctype html><meta charset="utf-8"><body style="margin:0;background:#123540">
<canvas id="c" style="width:1300px;height:560px"></canvas>
<script type="module">
import { SPECIES } from "../web/creatures/species.js";
import { Fish } from "../web/creatures/fish.js";
const q = new URLSearchParams(location.search), id = q.get("id") || "clown";
const cv = document.getElementById("c"), c = cv.getContext("2d"); cv.width = 2600; cv.height = 1120; c.scale(2, 2);
const world = { width: 1300, height: 560, px: 14, time: 0, fish: [], pellets: [], ground: () => 9999, home: () => ({ x: 600, y: 200 }) };
const f = new Fish(SPECIES[id], world); f.z = 0; f.pitch = 0; f.facing = 1;
// top row: a turn from facing right to facing left; bottom row: tail beat phases
const turns = [0, .15, .3, .42, .5, .58, .7, .85];
turns.forEach((t, i) => { f.turn = t; f.turnFrom = 1; f.facing = t >= .5 ? -1 : 1; f.x = 80 + i * 160; f.y = 140; f.beat = .6; f.tail = 1; f.draw(c, world); });
f.turn = 0; f.facing = 1;
[0, .8, 1.6, 2.4, 3.2, 4, 4.8, 5.6].forEach((ph, i) => { f.tail = ph; f.fin = ph * 1.3; f.beat = .9; f.x = 80 + i * 160; f.y = 400; f.draw(c, world); });
</script>
```

浏览器模式要用的三份存档（0 位、原有 4 位、全部 15 位访客），写到 `/tmp/reef-saves/`：

```bash
mkdir -p /tmp/reef-saves && cd /tmp/reef-saves && python3 - <<'PY'
import json, os
base = {"revision": 1, "preferences": {"focusMinutes": 25, "breakMinutes": 5, "sound": "waves", "volume": 0.35, "soundEnabled": False, "chimeEnabled": True},
        "session": {"id": 1, "kind": "focus", "status": "idle", "task": "", "durationMs": 1500000, "elapsedMs": 0, "startedAt": ""},
        "completed": 0, "totalSecs": 0, "records": [], "visitors": []}
names = [("clown","小丑鱼"),("tang","蓝吊鱼"),("angel","神仙鱼"),("puffer","小河豚"),("cleaner","清洁虾"),("fire","火焰虾"),("harlequin","油彩蜡膜虾"),("pistol","枪虾"),("mantis","皮皮虾"),("slipper","琵琶虾"),("hermit","寄居蟹"),("emerald","翡翠蟹"),("porcelain","瓷蟹"),("arrow","箭蟹"),("swimmer","梭子蟹")]
for label, n, completed in [("none", 0, 0), ("four", 4, 9), ("all", 15, 30)]:
    d = dict(base, completed=completed, totalSecs=completed * 1500,
             visitors=[{"species": s, "name": nm, "date": f"2026-10-{1+i:02d}T10:00:00+08:00", "visits": 1} for i, (s, nm) in enumerate(names[:n])])
    os.makedirs(label, exist_ok=True)
    json.dump(d, open(f"{label}/aquarium.json", "w"), ensure_ascii=False)
PY
# 每份存档单独开一个浏览器模式，例如：
CGO_ENABLED=0 go run . -web 127.0.0.1:4193 -data-dir /tmp/reef-saves/all
```

---

### Task 1: 共用的绘制与运动工具

**Files:**
- Create: `web/creatures/paint.js`
- Create: `web/creatures/motion.js`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `paint.js`：`rgb(hex) → [r,g,b]`；`tone(hex, haze = 0, alpha = 1, light = 0) → "rgba(…)"`（`light` 取 −1…1，`haze` 取 0…1，向水色雾化）；`shade(haze) → (hex, alpha = 1, light = 0) => tone(…)`，每个画图函数用它取当前深度的颜色；`curve(path, points, closed = false, move = true)` 在 Path2D 或 context 上画平滑曲线；`limb(c, points, base, tip, color)`；`shadow(c, x, y, rx, ry, alpha)`；`dot(c, x, y, r)`；`oval(c, x, y, rx, ry, rotation = 0)`；`wind(points)` 统一成顺时针；`hole(c, x, y, r)` / `lip(c, x, y, r)` 画洞口和洞口前沿。
  - `motion.js`：`TAU`、`clamp`、`lerp`、`smooth`、`hash(text)`、`random(seed) → () => [0,1)`、`noise(seed, t) → −1…1`、`follow(value, target, rate, dt)`、`knee(hx, hy, fx, fy, upper, lower, up = true) → [x, y]`。
  - `class Gait(legs, { stride, lift, duration })`：`legs` 每项为 `{ dx, group, dz? }`，`dx` 以体长为单位。方法有 `place(x, sx, ground)`、`update(dt, x, sx, ground, vx)` 和 getter `airborne`；`legs[i].x/.y` 是脚在画布上的位置。
  - `class Crawler(spec, world, { enter })`：字段有 `crawler`、`active`、`state`（`"in" | "out" | "leaving"`）、`home`、`den`、`depths`、`hides`、`x`、`y`、`z`、`facing`、`vx`、`goal`、`eating`、`meal`、`shown`、`clock`、`turn`、`retreat`、`busy`；方法有 `size(world)`、`settle(world)`、getter `hidden`、getter `flipX`（画图用的横向缩放：朝向乘以转身时的压缩）、`localFeet(L, lift = 0)`（把脚的位置换算成体长单位）、`setActive(on, world, instant)`、`resize(sx, sy, world)`、`legScale(world)`、`footing(world)`、`wander(world)`、`routine(dt, world)`、`forage(world)`、`reach(L)`、`watch(world, L)`、`startle(world)`、`hideAway(seconds)`、`drop()`。
  - 场景提供给模型的 `world`：`width`、`height`、`px`（每厘米多少像素）、`time`、`still`、`fish`（鱼的数组）、`pellets`、`meal`（第几次喂食）、`rocks`、`burrows`，以及方法 `ground(x, z)`、`surface(x, z)`、`home()`、`eat(pellet)`。

- [ ] **Step 1: 写 `web/creatures/paint.js`**

```js
// Colors and outline helpers shared by the creature models.
const parsed = new Map();

// rgb parses a "#rrggbb" color once.
export function rgb(hex) {
  let c = parsed.get(hex);
  if (!c) parsed.set(hex, c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  return c;
}

// Distance fades every color toward the water, the stage's middle tone.
const WATER = rgb("#173f4c");

// tone returns a CSS color: light (−1…1) darkens or lightens it first, then
// haze (0…1) fades it toward the water the way distance does.
export function tone(hex, haze = 0, alpha = 1, light = 0) {
  const c = rgb(hex);
  let r = c[0], g = c[1], b = c[2];
  if (light > 0) { r += (255 - r) * light; g += (255 - g) * light; b += (255 - b) * light; }
  else if (light < 0) { r *= 1 + light; g *= 1 + light; b *= 1 + light; }
  r += (WATER[0] - r) * haze; g += (WATER[1] - g) * haze; b += (WATER[2] - b) * haze;
  return `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;
}

// shade returns tone() bound to one creature's haze, so painters can write col(hex, alpha, light).
export function shade(haze) { return (hex, alpha = 1, light = 0) => tone(hex, haze, alpha, light); }

// curve adds a smooth line through points (Catmull-Rom as cubic Béziers) to a
// path or a context; closed curves wrap around to the first point.
export function curve(path, points, closed = false, move = true) {
  const n = points.length;
  const at = i => closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  if (move) path.moveTo(points[0][0], points[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    path.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) path.closePath();
  return path;
}

// limb strokes a jointed leg through points, thinning from base to tip.
export function limb(c, points, base, tip, color) {
  c.strokeStyle = color; c.lineCap = "round"; c.lineJoin = "round";
  for (let i = 1; i < points.length; i++) {
    c.lineWidth = base + (tip - base) * (i - 1) / Math.max(1, points.length - 2);
    c.beginPath(); c.moveTo(points[i - 1][0], points[i - 1][1]); c.lineTo(points[i][0], points[i][1]); c.stroke();
  }
}

// shadow lays the soft contact shadow under something resting on the sand.
export function shadow(c, x, y, rx, ry, alpha) {
  c.save(); c.translate(x, y); c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(8,22,20,${alpha})`); g.addColorStop(1, "rgba(8,22,20,0)");
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill(); c.restore();
}

// dot fills a circle.
export function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }

// oval fills an ellipse.
export function oval(c, x, y, rx, ry, rotation = 0) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rotation, 0, Math.PI * 2); c.fill(); }

// wind returns polygon points in clockwise order, so overlapping parts of
// one body add up when filled or clipped together.
export function wind(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) { const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % points.length]; area += x0 * y1 - x1 * y0; }
  return area < 0 ? points.slice().reverse() : points;
}

// hole draws a burrow opening with its ring of dug-out sand; lip redraws the
// front of the ring over whatever is still down in the burrow.
export function hole(c, x, y, r) {
  c.fillStyle = "#7f8e78"; oval(c, x, y, r * 1.6, r * .55);
  c.fillStyle = "#16201d"; oval(c, x, y - r * .06, r * .85, r * .3);
}
export function lip(c, x, y, r) {
  c.fillStyle = "#7f8e78"; c.beginPath(); c.ellipse(x, y, r * 1.6, r * .55, 0, 0, Math.PI); c.fill();
  c.fillStyle = "rgba(160,172,150,.5)"; c.beginPath(); c.ellipse(x, y + r * .05, r * 1.2, r * .32, 0, .2, Math.PI - .2); c.fill();
}
```

- [ ] **Step 2: 写 `web/creatures/motion.js`**

```js
// Motion shared by the creature models: seeded randomness, smooth noise,
// limbs, legs that keep their feet planted, and the crawlers' daily routine.
export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);

// hash turns a species id into a stable seed, so placement survives redraws.
export function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

// random returns a seeded generator of numbers in [0, 1).
export function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lattice(seed, i) {
  let h = Math.imul(seed ^ Math.imul(i, 374761393), 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 2147483648 - 1;
}

// noise is smooth value noise in −1…1 along t, different for every seed.
export function noise(seed, t) {
  const i = Math.floor(t);
  return lerp(lattice(seed, i), lattice(seed, i + 1), smooth(t - i));
}

// follow eases a value toward its target; rate is how quickly, per second.
export function follow(value, target, rate, dt) {
  return target + (value - target) * Math.exp(-rate * dt);
}

// knee finds the joint of a two-segment limb from a hip to a foot, on the
// upper side of the line between them (or the lower side when up is false).
export function knee(hx, hy, fx, fy, upper, lower, up = true) {
  const dx = fx - hx, dy = fy - hy;
  const d = clamp(Math.hypot(dx, dy), 1e-6, upper + lower - 1e-6);
  const a = (upper * upper - lower * lower + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const ux = dx / d, uy = dy / d, px = hx + ux * a, py = hy + uy * a;
  const side = (ux > 0) === up ? -1 : 1;
  return [px - uy * h * side, py + ux * h * side];
}

// Gait keeps each foot planted until the body has moved past it, then
// swings it ahead. Legs belong to two groups that never swing at the same
// time, so the walk alternates the way a real one does. Rest offsets are in
// body lengths; sx scales them to pixels and mirrors them with the facing.
export class Gait {
  constructor(legs, { stride = .3, lift = .08, duration = .2 } = {}) {
    this.legs = legs.map(leg => ({ group: 0, ...leg, x: 0, y: 0, fromX: 0, fromY: 0, toX: 0, t: 1 }));
    this.stride = stride; this.lift = lift; this.duration = duration;
    this.placed = false;
  }

  // place puts every foot straight under its rest position.
  place(x, sx, ground) {
    for (const leg of this.legs) { leg.x = leg.toX = x + leg.dx * sx; leg.y = ground(leg.x, leg); leg.t = 1; }
    this.placed = true;
  }

  // update swings stepping feet and starts new steps; vx is the body's speed.
  update(dt, x, sx, ground, vx) {
    if (!this.placed) { this.place(x, sx, ground); return; }
    const L = Math.abs(sx), stride = this.stride * L, walking = Math.abs(vx) > stride * .25;
    for (const leg of this.legs) {
      if (leg.t < 1) {
        leg.t = Math.min(1, leg.t + dt / this.duration);
        const e = smooth(leg.t);
        leg.x = lerp(leg.fromX, leg.toX, e);
        leg.y = lerp(leg.fromY, ground(leg.x, leg), e) - Math.sin(Math.PI * leg.t) * this.lift * L;
      } else leg.y = ground(leg.x, leg);
    }
    for (const leg of this.legs) {
      if (leg.t < 1) continue;
      const rest = x + leg.dx * sx;
      if (Math.abs(leg.x - rest) < stride * (walking ? .5 : .15)) continue;
      if (this.legs.some(o => o.t < 1 && o.group !== leg.group)) continue;
      leg.fromX = leg.x; leg.fromY = leg.y;
      leg.toX = rest + (walking ? Math.sign(vx) * stride * .45 : 0);
      leg.t = 0;
    }
  }

  // airborne tells how much of the body's weight is off the ground (0…1).
  get airborne() {
    let up = 0;
    for (const leg of this.legs) if (leg.t < 1) up += Math.sin(Math.PI * leg.t);
    return up / this.legs.length;
  }
}

// Crawler is the routine shared by shrimp and crabs. While out it wanders
// near home, picks up food that reached the sand and flinches when a fish
// comes close; sent in, it walks to its den and rests or hides there.
// Models add the body, legs and drawing.
export class Crawler {
  constructor(spec, world, { enter = false } = {}) {
    this.spec = spec;
    this.seed = hash(spec.id);
    this.rand = random(this.seed ^ 0x51ed27);
    this.crawler = true;
    this.active = false;
    this.state = "in";
    this.settle(world);
    this.x = this.den.x; this.z = this.den.z;
    this.facing = this.rand() < .5 ? -1 : 1;
    this.vx = 0; this.goal = null; this.until = 0;
    this.meal = null; this.eating = 0; this.calm = 0;
    this.turn = 0; this.shown = 0; this.clock = this.rand() * 100; this.retreat = 0;
    if (enter) {
      this.state = "out"; this.active = true; this.shown = 1;
      this.x = this.rand() < .5 ? -world.width * .04 : world.width * 1.04;
      this.z = this.home.z; this.goal = { x: this.home.x, z: this.home.z };
    }
    this.y = world.surface(this.x, this.z);
  }

  // size is the body length in pixels at the current depth.
  size(world) { return this.spec.length * world.px * (1 - .3 * this.z); }

  // settle chooses home (where it spends its time out) and den (where it
  // rests). Rock dwellers live on a rock and hide behind it; others use a
  // patch of sand. Models with burrows override this.
  settle(world) {
    const W = world.width, s = this.spec;
    if (s.rock) {
      const rocks = world.rocks, r = rocks[[0, 2, 1, 3][this.seed % 4] % rocks.length];
      const x = r.x + (this.rand() - .5) * r.rx * .8;
      this.home = { x, z: r.z };
      this.den = { x: r.x + (this.rand() - .5) * r.rx * .4, z: Math.min(1, r.z + .22) };
      this.depths = [Math.max(0, r.z - .12), r.z + .04];
      this.hides = true;
    } else {
      const x = W * (.12 + (this.seed % 1000) / 1000 * .76);
      const [z0, z1] = s.depths || [.15, .7];
      this.home = { x, z: lerp(z0, z1, this.rand()) };
      this.den = this.home;
      this.depths = [z0, z1];
      this.hides = false;
    }
  }

  // hidden reports whether nothing of it shows right now.
  get hidden() { return this.shown < .02; }

  setActive(on, world, instant = false) {
    const was = this.state;
    this.active = on;
    this.drop();
    if (on) {
      if (instant) { this.x = this.home.x; this.z = this.home.z; this.goal = null; this.until = world.time + this.rand() * 4; this.shown = 1; }
      else { if (was === "in") { this.x = this.den.x; this.z = this.den.z; } this.goal = { x: this.home.x, z: this.home.z }; }
      this.state = "out";
    } else if (instant) {
      this.state = "in"; this.x = this.den.x; this.z = this.den.z; this.goal = null; this.vx = 0;
      this.shown = this.hides ? 0 : 1;
    } else {
      this.state = "leaving"; this.goal = { x: this.den.x, z: this.den.z };
    }
    this.y = world.surface(this.x, this.z);
  }

  resize(sx, sy, world) {
    this.settle(world);
    this.x *= sx; this.goal = null;
    if (this.state !== "out") { this.state = this.active ? "out" : "in"; this.x = this.active ? this.home.x : this.den.x; this.z = this.active ? this.home.z : this.den.z; }
    this.y = world.surface(this.x, this.z);
    this.legs?.place(this.x, this.legScale(world), this.footing(world));
  }

  // flipX is the horizontal scale for drawing: the facing, squashed while it turns around.
  get flipX() { return this.turn ? this.facing * Math.max(.2, Math.abs(Math.cos(Math.PI * this.turn))) : this.facing; }

  // localFeet maps the feet into body units for drawing, with the body raised by lift pixels.
  localFeet(L, lift = 0) {
    const sx = this.spec.sideways ? L : this.flipX * L;
    return this.legs.legs.map(leg => [(leg.x - this.x) / sx, (leg.y - this.y + lift) / L]);
  }

  // legScale mirrors leg offsets with the facing; front-on crabs don't.
  legScale(world) { return this.size(world) * (this.spec.sideways ? 1 : this.facing); }

  // footing is the ground the legs stand on: the body's own surface, with
  // feet on the far side a little higher, as they would look from above.
  footing(world) { const L = this.size(world); return (x, leg) => world.surface(x, this.z) - (leg.dz || 0) * L * 1.5; }

  // wander picks the next spot to walk to while out.
  wander(world) {
    const r = world.width * (this.spec.range || .2);
    return { x: clamp(this.home.x + (this.rand() * 2 - 1) * r, world.width * .04, world.width * .96), z: lerp(this.depths[0], this.depths[1], this.rand()) };
  }

  // routine moves the body; models call it from step before animating.
  routine(dt, world) {
    const t = world.time, L = this.size(world);
    this.clock += dt;
    // After a scare it stays home a while, then comes back out.
    if (this.retreat > 0 && (this.retreat -= dt) <= 0 && this.active && this.state === "in") { this.state = "out"; this.goal = { x: this.home.x, z: this.home.z }; }
    if (this.eating > 0) {
      this.eating -= dt; this.vx = follow(this.vx, 0, 8, dt);
      if (this.eating <= 0 && this.meal) { world.eat(this.meal); this.meal = null; }
    } else if (this.state !== "in" && !this.busy) {
      if (this.state === "out") {
        const food = this.forage(world);
        if (food) this.goal = { x: food.x - this.reach(L) * (Math.sign(food.x - this.x) || this.facing), z: food.z, food };
        else if (!this.goal && t > this.until) this.goal = this.wander(world);
        if (t > this.calm) this.watch(world, L);
      }
      if (this.goal) {
        const dx = this.goal.x - this.x, dz = this.goal.z - this.z;
        const speed = this.spec.speed * L * (this.state === "leaving" ? 1.2 : 1);
        this.vx = follow(this.vx, clamp(dx * 3, -speed, speed), 4, dt);
        this.z = clamp(this.z + clamp(dz * 1.5, -.2, .2) * dt, 0, 1);
        if (Math.abs(dx) < L * .1 && Math.abs(dz) < .03) {
          if (this.goal.food && !this.goal.food.eaten) { this.meal = this.goal.food; this.eating = 1.8; }
          this.goal = null;
          if (this.state === "leaving") this.state = "in";
          else this.until = t + (2 + this.rand() * 6) * (this.spec.idle || 1);
        }
      } else this.vx = follow(this.vx, 0, 6, dt);
    } else if (!this.busy) this.vx = follow(this.vx, 0, 6, dt);
    this.x += this.vx * dt;
    if (!this.spec.sideways && !this.turn && Math.abs(this.vx) > L * .08 && Math.sign(this.vx) !== this.facing) this.turn = 1e-3;
    if (this.turn) { this.turn += dt / .35; if (this.turn >= .5) this.facing = Math.sign(this.vx) || this.facing; if (this.turn >= 1) this.turn = 0; }
    this.shown = follow(this.shown, this.state === "in" && this.hides ? 0 : 1, 3, dt);
    this.y = world.surface(this.x, this.z);
  }

  // forage finds food lying on the sand within reach of home.
  forage(world) {
    if (this.goal?.food && !this.goal.food.eaten) return this.goal.food;
    let best = null, bd = world.width * (this.spec.range || .2) * 1.5;
    for (const p of world.pellets) {
      if (!p.landed || p.eaten || p.claimed) continue;
      const d = Math.abs(p.x - this.x);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) best.claimed = true;
    return best;
  }

  // reach is how far from the body's center food is picked up.
  reach(L) { return this.spec.sideways ? 0 : L * .4; }

  // watch flinches when a fish swims within a body length.
  watch(world, L) {
    for (const f of world.fish) {
      if (Math.abs(f.z - this.z) > .3) continue;
      if (Math.hypot(f.x - this.x, f.y - this.y) < L + f.size(world) * .4) { this.calm = world.time + 8; this.startle(world, f); return; }
    }
  }

  // startle is the model's flinch; by default it freezes for a moment.
  startle(world) { this.goal = null; this.until = world.time + 2.5; }

  // hideAway runs home to the den for a while, still counted as out.
  hideAway(seconds) { this.drop(); this.retreat = seconds; this.state = "leaving"; this.goal = { x: this.den.x, z: this.den.z }; }

  // drop gives up the pellet it was walking to, so another can have it.
  drop() { if (this.goal?.food) this.goal.food.claimed = false; }

}
```

- [ ] **Step 3: 检查语法和关节求解**

```bash
node --check web/creatures/paint.js && node --check web/creatures/motion.js && cd web/creatures && node -e 'import("./motion.js").then(m => console.log(m.knee(0, 0, 10, 10, 9, 9), m.knee(0, 0, -10, 10, 9, 9)))'
```

Expected：两个膝盖的 y 都约为 1.06，也就是在髋和脚的连线上方：`[ 8.937…, 1.062… ] [ -8.937…, 1.062… ]`。

- [ ] **Step 4: Commit**

```bash
git add web/creatures/paint.js web/creatures/motion.js
git commit -m "feat(aquarium): add shared drawing and motion helpers for sea creatures"
```

### Task 2: 场景改造与写实的鱼

**Files:**
- Create: `web/creatures/fish.js`
- Create: `web/creatures/species.js`（这一步只注册鱼的模型）
- Rewrite: `web/reef.js`

**Interfaces:**
- Consumes: Task 1 的 `paint.js` 和 `motion.js`。
- Produces:
  - `fish.js`：`class Fish(spec, world, { enter })`，有 `size(world)`、`resize(sx, sy)`、`step(dt, world)`、`draw(c, world)` 和 `static portrait(c, spec, w, h)`；字段 `z`、`facing`、`mode`（`"swim" | "hover"`）、`turn`、`turnFrom`、`appetite`。
  - `species.js`：`SPECIES`（16 个条目，`id` 与存档一致，外加 `resident`）、`create(id, world, options)`（物种不认识或模型还没注册时返回 `null`）、`drawPortrait(canvas, id)`（不认识的物种画通用剪影）。
  - 每个模型都要提供：`step(dt, world)`、`draw(c, world)`、`resize(sx, sy, world)`、`z`、`static portrait(c, spec, w, h)`；虾蟹另有 `crawler`、`active`、`home`、`setActive(on, world, instant)`，可选的 `under(c, world)` 在其他东西之前画（比如洞口）。

- [ ] **Step 1: 搭好验收工具**

按上面“验收工具”一节，把 `index.html` 和 `turn.html` 放进 `/tmp/reef-check/harness/`，再起静态服务器。

- [ ] **Step 2: 用现在的代码跑 5 位访客，确认会失败**

打开 `http://127.0.0.1:4180/harness/index.html?v=clown,tang,angel,puffer,cleaner&g=6`，在控制台执行：

```js
[...new Set(errors)]
```

Expected：`["TypeError: Cannot read properties of undefined (reading 'y')", …]`。这正是旧 `reef.js` 只有 5 个鱼位的问题。

- [ ] **Step 3: 写 `web/creatures/fish.js`**

```js
import { curve, dot, oval, shade } from "./paint.js";
import { TAU, clamp, follow, hash, lerp, noise, random } from "./motion.js";

// Looks are drawn facing right in units of body length: the snout is at
// x = .5 and the base of the tail at x = −.5, and y grows downward. Body
// stations are [x, top, bottom]. A fin lists its outer edge from front to
// back; its base runs along the body under the first and last points. The
// tail fin, pectoral and pelvic fins are drawn from their own base point.
const LOOKS = {
  // Lyretail anthias (sea goldfish), female: the resident.
  resident: {
    body: [[.5, .005, .01], [.45, -.07, .06], [.36, -.14, .12], [.2, -.18, .155], [0, -.18, .155], [-.2, -.145, .125], [-.36, -.095, .08], [-.5, -.065, .055]],
    eye: [.35, -.035, .062], mouth: [.5, .006], gill: .21,
    dorsal: { edge: [[.25, -.16], [.21, -.25], [.14, -.27], [.06, -.265], [-.02, -.26], [-.1, -.255], [-.19, -.26], [-.28, -.25], [-.35, -.2], [-.41, -.1]] },
    anal: { edge: [[-.07, .14], [-.12, .23], [-.2, .29], [-.28, .25], [-.35, .16], [-.4, .085]] },
    caudal: { edge: [[0, -.065], [-.1, -.15], [-.26, -.25], [-.52, -.37], [-.33, -.17], [-.24, -.03], [-.24, .03], [-.33, .17], [-.52, .37], [-.26, .25], [-.1, .15], [0, .065]] },
    pectoral: { at: [.2, .045], edge: [[0, -.025], [-.08, -.05], [-.17, -.035], [-.2, .005], [-.15, .04], [-.07, .045], [0, .025]], angle: .25 },
    pelvic: { at: [.15, .14], edge: [[0, -.01], [-.05, .08], [-.17, .17], [-.1, .06], [-.03, .01]] },
    pattern(c, col) {
      // A violet line runs from under the eye down to the pectoral fin.
      c.strokeStyle = col("#a98ad8", .9); c.lineWidth = .028; c.lineCap = "round";
      c.beginPath(); c.moveTo(.33, .03); c.quadraticCurveTo(.26, .06, .18, .085); c.stroke();
    },
  },
  // Ocellaris clownfish.
  clown: {
    body: [[.5, .015, .025], [.47, -.07, .09], [.38, -.19, .18], [.22, -.255, .225], [0, -.26, .23], [-.2, -.2, .18], [-.36, -.13, .115], [-.5, -.1, .085]],
    eye: [.345, -.05, .062], mouth: [.5, .02], gill: .27,
    dorsal: { edge: [[.23, -.24], [.19, -.31], [.13, -.335], [.07, -.34], [.02, -.325], [-.03, -.29], [-.07, -.35], [-.15, -.39], [-.24, -.37], [-.31, -.3], [-.36, -.16]], line: "#1d1512" },
    anal: { edge: [[-.1, .21], [-.14, .3], [-.21, .34], [-.29, .3], [-.35, .2], [-.37, .11]], line: "#1d1512" },
    caudal: { edge: [[0, -.09], [-.08, -.19], [-.19, -.24], [-.29, -.19], [-.33, -.08], [-.34, 0], [-.33, .08], [-.29, .19], [-.19, .24], [-.08, .19], [0, .09]], line: "#1d1512" },
    pectoral: { at: [.18, .05], edge: [[0, -.025], [-.07, -.055], [-.15, -.045], [-.19, 0], [-.16, .045], [-.08, .055], [0, .025]], angle: .2 },
    pelvic: { at: [.13, .2], edge: [[0, -.01], [-.05, .06], [-.12, .11], [-.09, .05], [-.03, 0]], line: "#1d1512" },
    pattern(c, col) {
      // Three white bands, each edged with a thin black line.
      const bands = [
        [[.29, -.3], [.245, 0], [.28, .28], [.2, .28], [.17, 0], [.2, -.3]],
        [[.03, -.31], [.11, -.03], [.03, .27], [-.08, .27], [-.02, -.03], [-.08, -.31]],
        [[-.39, -.16], [-.39, .16], [-.46, .16], [-.46, -.16]],
      ];
      for (const band of bands) {
        const p = curve(new Path2D(), band, true);
        c.fillStyle = col("#fbf6ec"); c.fill(p);
        c.strokeStyle = col("#1d1512", .9); c.lineWidth = .016; c.stroke(p);
      }
    },
  },
  // Palette surgeonfish (blue tang).
  tang: {
    body: [[.5, .03, .035], [.46, -.06, .1], [.37, -.18, .2], [.2, -.255, .255], [0, -.265, .265], [-.2, -.225, .22], [-.37, -.13, .12], [-.5, -.06, .055]],
    eye: [.35, -.07, .05], mouth: [.5, .033], gill: .25,
    dorsal: { edge: [[.31, -.2], [.24, -.28], [.12, -.33], [0, -.345], [-.12, -.34], [-.24, -.3], [-.34, -.22], [-.42, -.1]], line: "#10141c", lineWidth: 2 },
    anal: { edge: [[.06, .25], [-.05, .32], [-.17, .335], [-.28, .29], [-.37, .2], [-.43, .085]], line: "#10141c", lineWidth: 2 },
    caudal: { edge: [[0, -.055], [-.08, -.13], [-.2, -.24], [-.34, -.33], [-.27, -.16], [-.22, 0], [-.27, .16], [-.34, .33], [-.2, .24], [-.08, .13], [0, .055]], color: "#f2c64a", line: "#10141c", lineWidth: 2.4 },
    pectoral: { at: [.2, .05], edge: [[0, -.03], [-.09, -.06], [-.2, -.05], [-.24, 0], [-.19, .045], [-.09, .05], [0, .03]], angle: .15, tip: "#f2c64a" },
    pelvic: { at: [.16, .22], edge: [[0, -.01], [-.04, .05], [-.1, .08], [-.07, .03], [-.02, 0]] },
    pattern(c, col) {
      // The black "palette" runs from the eye along the back to the tail and
      // loops down around an oval of blue.
      c.fillStyle = col("#10141c");
      c.fill(curve(new Path2D(), [[.4, -.06], [.3, -.19], [.12, -.255], [-.1, -.25], [-.3, -.19], [-.46, -.1], [-.56, -.03], [-.56, .05], [-.44, .07], [-.3, .1], [-.14, .15], [0, .14], [.1, .06], [.15, -.03], [.24, -.05], [.33, -.02]], true));
      c.fillStyle = col("#2f62c2"); oval(c, -.14, -.065, .19, .085, -.08);
      c.fillStyle = col("#3d6fcc", .9); oval(c, -.5, .0, .05, .03);
    },
  },
  // Queen angelfish.
  angel: {
    body: [[.5, .04, .06], [.46, -.06, .14], [.38, -.2, .24], [.24, -.31, .31], [.05, -.34, .33], [-.15, -.31, .3], [-.33, -.2, .2], [-.5, -.085, .085]],
    eye: [.37, -.04, .05], mouth: [.5, .05], gill: .29,
    dorsal: { edge: [[.27, -.3], [.18, -.4], [.05, -.45], [-.1, -.47], [-.25, -.47], [-.4, -.45], [-.55, -.43], [-.72, -.41], [-.86, -.38], [-.62, -.3], [-.5, -.18], [-.47, -.09]], line: "#4fb2f0", lineWidth: 1.6, flow: true },
    anal: { edge: [[.03, .32], [-.08, .42], [-.22, .46], [-.38, .46], [-.55, .44], [-.72, .42], [-.84, .39], [-.6, .3], [-.5, .18], [-.47, .09]], line: "#4fb2f0", lineWidth: 1.6, flow: true },
    caudal: { edge: [[0, -.085], [-.06, -.18], [-.18, -.24], [-.27, -.2], [-.29, 0], [-.27, .2], [-.18, .24], [-.06, .18], [0, .085]], color: "#f4c530" },
    pectoral: { at: [.22, .06], edge: [[0, -.03], [-.08, -.06], [-.18, -.05], [-.22, 0], [-.18, .045], [-.08, .055], [0, .03]], color: "#f4c530", angle: .2 },
    pelvic: { at: [.2, .27], edge: [[0, -.01], [-.06, .1], [-.2, .25], [-.12, .08], [-.04, 0]], color: "#f4c530" },
    pattern(c, col) {
      // Scales with yellow centers, a blue face, and the crown on the forehead.
      c.fillStyle = col("#e9c94a", .42);
      for (let y = -.32, row = 0; y < .34; y += .045, row++) for (let x = -.48 + (row & 1) * .022; x < .32; x += .045) dot(c, x + Math.sin(x * 91 + y * 37) * .006, y + Math.cos(x * 53 - y * 71) * .006, .011);
      const face = c.createRadialGradient(.42, .02, 0, .42, .02, .22);
      face.addColorStop(0, col("#3f74b8", .75)); face.addColorStop(1, col("#3f74b8", 0));
      c.fillStyle = face; c.fillRect(.15, -.3, .4, .6);
      c.strokeStyle = col("#4fb2f0", .9); c.lineWidth = .014;
      c.beginPath(); c.arc(.31, .02, .14, -1.2, 1.3); c.stroke();
      c.fillStyle = col("#4fb2f0"); dot(c, .25, -.235, .055);
      c.fillStyle = col("#15245a"); dot(c, .25, -.235, .042);
      c.fillStyle = col("#4fb2f0"); dot(c, .25, -.235, .012);
    },
  },
  // Valentini's sharpnose puffer.
  puffer: {
    body: [[.5, .025, .04], [.45, -.06, .1], [.33, -.18, .2], [.15, -.25, .25], [-.05, -.245, .25], [-.25, -.17, .19], [-.4, -.1, .11], [-.5, -.075, .075]],
    eye: [.28, -.1, .066], mouth: [.5, .033], gill: .17,
    dorsal: { edge: [[-.22, -.18], [-.25, -.27], [-.31, -.29], [-.36, -.21], [-.37, -.13]], ripple: true },
    anal: { edge: [[-.24, .18], [-.27, .27], [-.33, .28], [-.37, .2], [-.38, .13]], ripple: true },
    caudal: { edge: [[0, -.075], [-.07, -.15], [-.18, -.19], [-.26, -.15], [-.29, 0], [-.26, .15], [-.18, .19], [-.07, .15], [0, .075]], color: "#f1d27e", line: "#d98a3a" },
    pectoral: { at: [.15, .0], edge: [[0, -.025], [-.06, -.045], [-.12, -.03], [-.13, .01], [-.09, .035], [-.04, .035], [0, .02]], angle: .1 },
    pattern(c, col) {
      // Four brown saddles, orange spots low on the body, and fine blue-green
      // lines around the eye.
      c.fillStyle = col("#3b2a21");
      for (const s of [[[.36, -.2], [.2, -.27], [.18, -.1], [.3, -.05]], [[.1, -.3], [-.1, -.3], [-.12, .1], [-.02, .2], [.08, .08]], [[-.17, -.25], [-.31, -.2], [-.3, .03], [-.2, .08]], [[-.39, -.13], [-.5, -.1], [-.5, .02], [-.41, .0]]]) c.fill(curve(new Path2D(), s, true));
      c.fillStyle = col("#d27a33");
      for (const [x, y] of [[.38, .1], [.3, .15], [.22, .19], [.16, .12], [.05, .2], [-.08, .22], [-.2, .16], [-.28, .1], [-.36, .07], [.42, .03], [.12, .22]]) dot(c, x, y, .022);
      c.strokeStyle = col("#47b3a6", .9); c.lineWidth = .012;
      for (let i = 0; i < 7; i++) { const a = -.6 + i * .52, [ex, ey] = [.28, -.1]; c.beginPath(); c.moveTo(ex + Math.cos(a) * .08, ey + Math.sin(a) * .08); c.lineTo(ex + Math.cos(a) * .12, ey + Math.sin(a) * .12); c.stroke(); }
    },
  },
};

// A generic fish body for species without a look of their own yet.
const PLAIN = {
  body: [[.5, .01, .02], [.45, -.08, .08], [.33, -.17, .16], [.15, -.21, .2], [-.05, -.2, .19], [-.25, -.15, .14], [-.4, -.09, .08], [-.5, -.065, .06]],
  eye: [.33, -.05, .055], mouth: [.5, .015], gill: .21,
  dorsal: { edge: [[.18, -.2], [.08, -.28], [-.08, -.29], [-.22, -.25], [-.33, -.13]] },
  anal: { edge: [[-.12, .18], [-.18, .26], [-.28, .24], [-.35, .1]] },
  caudal: { edge: [[0, -.06], [-.1, -.15], [-.3, -.26], [-.25, 0], [-.3, .26], [-.1, .15], [0, .06]] },
  pectoral: { at: [.18, .04], edge: [[0, -.02], [-.08, -.045], [-.16, -.03], [-.17, .01], [-.08, .035], [0, .02]], angle: .2 },
};

const built = new Map();

// shape turns a look into paths, once.
function shape(look) {
  let s = built.get(look);
  if (s) return s;
  const top = x => station(look.body, x, 1), bottom = x => station(look.body, x, 2);
  const outline = [[look.body[0][0], (look.body[0][1] + look.body[0][2]) / 2], ...look.body.slice(1).map(([x, t]) => [x, t]), ...look.body.slice(1).reverse().map(([x, , b]) => [x, b])];
  s = { body: curve(new Path2D(), outline, true), top: Math.min(...look.body.map(b => b[1])), bottom: Math.max(...look.body.map(b => b[2])) };
  s.dorsal = look.dorsal && edgeFin(look.dorsal, x => top(x) + .025);
  s.anal = look.anal && edgeFin(look.anal, x => bottom(x) - .025);
  s.caudal = baseFin(look.caudal, [0, 0], true);
  s.pectoral = baseFin(look.pectoral, [0, 0]);
  s.pelvic = look.pelvic && baseFin(look.pelvic, [0, 0]);
  // Scales overlap from head to tail, so each shows a rim toward the tail.
  s.scales = new Path2D();
  for (let y = -.34, row = 0; y < .36; y += .05, row++) for (let x = -.47 + (row & 1) * .025; x < look.gill - .02; x += .05) { s.scales.moveTo(x - .03 * Math.cos(1), y - .03 * Math.sin(1)); s.scales.arc(x, y, .03, Math.PI + 1, Math.PI - 1, true); }
  const [ex] = look.eye;
  s.gill = new Path2D(); s.gill.moveTo(look.gill + .02, top(look.gill) * .7); s.gill.quadraticCurveTo(look.gill - .05, 0, look.gill + .01, bottom(look.gill) * .75);
  s.line = new Path2D(); s.line.moveTo(look.gill - .02, top(look.gill) * .5); s.line.quadraticCurveTo(0, top(0) * .62, -.46, -.01);
  s.rim = curve(new Path2D(), look.body.slice(1).map(([x, t]) => [x, t + .006]));
  // Bounds of everything, for fitting portraits.
  const pts = [...outline, ...(look.dorsal?.edge || []), ...(look.anal?.edge || []), ...look.caudal.edge.map(([x, y]) => [x - .5, y]), ...(look.pelvic ? look.pelvic.edge.map(([x, y]) => [x + look.pelvic.at[0], y + look.pelvic.at[1]]) : [])];
  s.bounds = { x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0]), ex), y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1])) };
  built.set(look, s);
  return s;
}

function station(body, x, k) {
  for (let i = 1; i < body.length; i++) if (x >= body[i][0]) { const a = body[i - 1], b = body[i], t = (x - b[0]) / (a[0] - b[0] || 1); return lerp(b[k], a[k], t); }
  return body[body.length - 1][k];
}

// edgeFin builds a fin whose base follows the body edge.
function edgeFin(fin, base) {
  const e = fin.edge, n = e.length, x0 = e[0][0], x1 = e[n - 1][0];
  const path = curve(new Path2D(), e);
  for (let i = 0; i <= 8; i++) { const x = lerp(x1, x0, i / 8); path.lineTo(x, base(x)); }
  path.closePath();
  const rays = new Path2D();
  for (let i = 1; i < n - 1; i++) { const x = lerp(x0, x1, i / (n - 1)); rays.moveTo(x, base(x)); rays.lineTo(e[i][0], e[i][1]); }
  const far = e.reduce((a, p) => Math.abs(p[1] - base(p[0])) > Math.abs(a[1] - base(a[0])) ? p : a);
  return { ...fin, path, rays, rim: curve(new Path2D(), e), from: [far[0], base(far[0])], to: far };
}

// baseFin builds a fin that fans out from one base point.
function baseFin(fin, [bx, by], tail = false) {
  const e = fin.edge, path = curve(new Path2D(), e, true), rays = new Path2D();
  for (let i = 1; i < e.length - 1; i++) {
    const from = tail ? [0, lerp(e[0][1], e[e.length - 1][1], i / (e.length - 1))] : [bx, by];
    rays.moveTo(from[0], from[1]); rays.lineTo(e[i][0], e[i][1]);
  }
  const far = e.reduce((a, p) => Math.hypot(p[0] - bx, p[1] - by) > Math.hypot(a[0] - bx, a[1] - by) ? p : a);
  return { ...fin, path, rays, rim: curve(new Path2D(), tail ? e.slice(1, -1) : e), from: [bx, by], to: [tail ? far[0] : far[0], tail ? 0 : far[1]] };
}

// paint draws a fin: a see-through membrane, its rays and an optional rim.
function paint(c, fin, color, col, alpha, hair) {
  const hue = fin.color || color, g = c.createLinearGradient(fin.from[0], fin.from[1], fin.to[0], fin.to[1]);
  g.addColorStop(0, col(hue, alpha)); g.addColorStop(.6, col(hue, alpha * .82, .06)); g.addColorStop(1, col(hue, alpha * .5, .14));
  c.fillStyle = g; c.fill(fin.path);
  c.strokeStyle = col(hue, alpha * .55, -.3); c.lineWidth = hair * .6; c.stroke(fin.rays);
  if (fin.tip) { c.save(); c.clip(fin.path); c.fillStyle = col(fin.tip, alpha + .1); c.fillRect(-.3, -.2, .16, .4); c.restore(); }
  if (fin.line) { c.strokeStyle = col(fin.line, .85); c.lineWidth = hair * (fin.lineWidth || 1.2); c.stroke(fin.rim); }
}

// draw paints a fish in unit space for the given pose.
function draw(c, look, s, pose, haze, L) {
  const col = shade(haze), C = pose.colors, hair = 1 / L;
  // The tail sweeps toward and away from us, so seen from the side it
  // narrows and twists rather than swinging up and down.
  const sweep = 1 - .55 * pose.beat * Math.sin(pose.tail) ** 2;
  c.save(); c.translate(-.5, 0); c.transform(sweep, Math.sin(pose.tail) * .12 * pose.beat, 0, 1, 0, 0);
  paint(c, s.caudal, C.fin, col, .72 + .22 * (1 - sweep), hair);
  c.restore();
  for (const [fin, sign] of [[s.dorsal, -1], [s.anal, 1]]) {
    if (!fin) continue;
    c.save();
    if (fin.flow) { c.translate(-.4, 0); c.rotate(Math.sin(pose.fin * .5) * .025 * sign); c.translate(.4, 0); }
    if (fin.ripple) { const x0 = fin.edge[0][0]; c.translate(x0, 0); c.transform(1, 0, Math.sin(pose.fin * 1.6) * .35, 1, 0, 0); c.translate(-x0, 0); }
    paint(c, fin, C.fin, col, .86, hair);
    c.restore();
  }
  if (s.pelvic) { c.save(); c.translate(...look.pelvic.at); c.rotate(-.1 + Math.sin(pose.fin * .7) * .08); c.translate(.05, 0); paint(c, s.pelvic, C.fin, col, .55, hair); c.restore(); }
  // Body: lighter below than above, then the species' markings, scales, and
  // the light from the surface.
  const g = c.createLinearGradient(0, s.top, 0, s.bottom);
  g.addColorStop(0, col(C.back)); g.addColorStop(.48, col(C.flank)); g.addColorStop(1, col(C.belly));
  c.fillStyle = g; c.fill(s.body);
  c.save(); c.clip(s.body);
  look.pattern?.(c, col, pose);
  if (L > 24) { c.strokeStyle = col("#0e1c22", .07); c.lineWidth = hair * .7; c.stroke(s.scales); }
  c.strokeStyle = col("#ffffff", .1); c.lineWidth = hair * .8; c.stroke(s.line);
  c.strokeStyle = col(C.back, .45, -.4); c.lineWidth = hair * 1.1; c.save(); c.translate(Math.sin(pose.breath) * .006, 0); c.stroke(s.gill); c.restore();
  const light = c.createLinearGradient(0, s.top, 0, s.bottom);
  light.addColorStop(0, `rgba(255,255,255,${.24 * (1 - haze)})`); light.addColorStop(.32, `rgba(255,255,255,${.05 * (1 - haze)})`);
  light.addColorStop(.62, "rgba(255,255,255,0)"); light.addColorStop(1, "rgba(4,22,30,.24)");
  c.fillStyle = light; c.fillRect(-.6, s.top, 1.2, s.bottom - s.top);
  c.restore();
  c.strokeStyle = `rgba(255,255,255,${.22 * (1 - haze)})`; c.lineWidth = hair * .9; c.stroke(s.rim);
  // Eye, with a glint from above.
  const [ex, ey, er] = look.eye;
  c.fillStyle = col("#0d0b0a", .45); dot(c, ex, ey, er * 1.1);
  const iris = c.createRadialGradient(ex, ey - er * .3, er * .2, ex, ey, er);
  iris.addColorStop(0, col(C.iris, 1, .25)); iris.addColorStop(1, col(C.iris, 1, -.35));
  c.fillStyle = iris; dot(c, ex, ey, er);
  c.fillStyle = "#050505"; dot(c, ex + pose.lookX * er * .2, ey + pose.lookY * er * .16, er * .62);
  c.fillStyle = `rgba(255,255,255,${.8 * (1 - haze * .6)})`; dot(c, ex + er * .28, ey - er * .34, er * .2);
  // Mouth, which opens for a bite.
  const [mx, my] = look.mouth;
  c.strokeStyle = col(C.back, .7, -.5); c.lineWidth = hair; c.beginPath(); c.moveTo(mx - .005, my); c.lineTo(mx - .055, my + .012); c.stroke();
  if (pose.gape > 0) { c.fillStyle = col("#2a1712", .85 * pose.gape); oval(c, mx - .01, my + .006, .028, .022 * pose.gape); }
  // The near pectoral fin rows over the body.
  const p = look.pectoral;
  c.save(); c.translate(...p.at); c.rotate(p.angle + Math.sin(pose.fin) * .4 * pose.paddle); c.scale(.6 + .4 * Math.abs(Math.cos(pose.fin)), 1);
  paint(c, s.pectoral, C.fin, col, .42, hair);
  c.restore();
}

const STILL = { tail: 0, beat: .2, fin: 1.2, breath: 0, gape: 0, lookX: .3, lookY: 0, paddle: .4 };

// Fish swim with their tails, row with their fins while hovering, keep their
// distance from each other and turn around with a visible pivot.
export class Fish {
  constructor(spec, world, { enter = false } = {}) {
    this.spec = spec;
    this.look = LOOKS[spec.id] || PLAIN;
    this.shape = shape(this.look);
    this.seed = hash(spec.id);
    this.rand = random(this.seed ^ 0x9e3779b9);
    this.colors = spec.colors;
    const r = random(this.seed);
    this.z = .15 + r() * .55;
    this.facing = r() < .5 ? -1 : 1;
    this.x = world.width * (.15 + r() * .7);
    this.y = world.height * lerp(spec.zone[0], spec.zone[1], .3 + r() * .4);
    if (enter) { this.x = this.facing > 0 ? -world.width * .08 : world.width * 1.08; }
    this.vx = 0; this.vy = 0; this.pitch = 0; this.turn = 0; this.turnTo = this.turnFrom = this.facing;
    this.tail = r() * TAU; this.fin = r() * TAU; this.breath = r() * TAU;
    this.beat = .3; this.burst = 0; this.gape = 0; this.lookX = .2; this.lookY = 0; this.paddle = .5;
    this.mode = enter ? "swim" : "hover"; this.until = 0; this.goal = null; this.meal = 0; this.appetite = 0;
  }

  size(world) { return this.spec.length * world.px * (1 - .3 * this.z); }

  resize(sx, sy) { this.x *= sx; this.y *= sy; this.goal = null; }

  // pick chooses the next place to swim to inside the species' zone.
  pick(world, L) {
    const s = this.spec, W = world.width, H = world.height;
    if (s.home) {
      const h = world.home(), r = Math.max(L * 2.2, W * .1);
      const x = clamp(h.x + (this.rand() * 2 - 1) * r, L, W - L);
      return [x, clamp(h.y + (this.rand() * 2 - 1) * r * .5, H * .12, world.ground(x, this.z) - L * .45)];
    }
    const x = L + this.rand() * (W - 2 * L);
    return [x, Math.min(H * lerp(s.zone[0], s.zone[1], this.rand()), world.ground(x, this.z) - L * .45)];
  }

  // hunt finds the nearest sinking pellet and bites it when close enough;
  // after a few bites a fish loses interest and leaves the rest to sink.
  hunt(world, L) {
    if (this.meal !== world.meal) { this.meal = world.meal; this.appetite = 2 + Math.floor(this.rand() * 2); }
    if (this.appetite <= 0) return null;
    let best = null, bd = Infinity;
    for (const p of world.pellets) {
      if (p.landed || p.eaten) continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < bd) { bd = d; best = p; }
    }
    if (best && Math.hypot(this.x + this.facing * L * .5 - best.x, this.y - best.y) < L * .18) { world.eat(best); this.gape = 1; this.appetite--; }
    return best && !best.eaten ? best : null;
  }

  step(dt, world) {
    const s = this.spec, L = this.size(world), W = world.width, H = world.height, t = world.time;
    this.z = follow(this.z, .1 + .65 * (noise(this.seed, t * .025) * .5 + .5), .2, dt);
    const cruise = s.speed * L;
    let goal = null, speed = cruise;
    const food = this.hunt(world, L);
    if (food) { goal = [food.x - this.facing * L * .45, food.y]; speed = cruise * 1.8; this.mode = "swim"; this.goal = null; }
    else {
      if (this.mode === "hover" && t > this.until) { this.mode = "swim"; this.goal = this.pick(world, L); }
      if (this.mode === "swim") {
        if (!this.goal) this.goal = this.pick(world, L);
        if (Math.hypot(this.goal[0] - this.x, this.goal[1] - this.y) < L * .6) {
          if (this.rand() < s.hover) { this.mode = "hover"; this.until = t + 2 + this.rand() * 6; this.goal = null; }
          else this.goal = this.pick(world, L);
        }
        goal = this.goal;
      }
    }
    let dvx, dvy;
    if (goal) {
      const dx = goal[0] - this.x, dy = goal[1] - this.y, d = Math.hypot(dx, dy) || 1;
      const v = speed * clamp(d / (L * 1.6), .3, 1) * (1 + this.burst * .9);
      dvx = dx / d * v; dvy = dy / d * v * .6;
    } else {
      dvx = noise(this.seed + 3, t * .4) * L * .12; dvy = noise(this.seed + 5, t * .3) * L * .08;
    }
    // Keep a polite distance from fish at a similar depth, or pass at another depth.
    for (const o of world.fish) {
      if (o === this || Math.abs(o.z - this.z) > .25) continue;
      const ox = this.x - o.x, oy = this.y - o.y, d = Math.hypot(ox, oy) || 1, near = (L + o.size(world)) * .75;
      if (d < near) {
        const push = (near - d) / near;
        dvx += ox / d * push * cruise * 3.5; dvy += oy / d * push * cruise * 5;
        // Crowded at the same depth, one drifts in front and the other behind.
        this.z = clamp(this.z + (Math.sign(this.z - o.z) || (this.seed > o.seed ? 1 : -1)) * push * .8 * dt, 0, .9);
      }
    }
    // Stay in the water and inside the glass.
    const floor = world.ground(this.x, this.z) - L * .3;
    if (this.y > floor) dvy -= (this.y - floor) * 3;
    if (this.y < H * .08) dvy += (H * .08 - this.y) * 3;
    if (this.x < L * .6) dvx += (L * .6 - this.x) * 2;
    if (this.x > W - L * .6) dvx -= (this.x - W + L * .6) * 2;
    const accel = cruise * 2.4;
    let ax = clamp((dvx - this.vx) * 2.2, -accel, accel);
    const ay = clamp((dvy - this.vy) * 2.2, -accel, accel);
    if (this.turn > 0 && this.turn < .5) ax = -this.vx * 3;
    this.vx += ax * dt; this.vy += ay * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    // Face the way it swims; hovering fish may face into the current or look around.
    let want = this.facing;
    if (Math.abs(this.vx) > L * .25) want = Math.sign(this.vx);
    else if (this.mode === "hover" && !food) {
      if (s.upstream) want = -1;
      else if (s.curious && noise(this.seed + 9, t * .12) > .45) want = -this.facing;
    }
    if (!this.turn && want !== this.facing) { this.turn = 1e-3; this.turnTo = want; this.turnFrom = this.facing; }
    if (this.turn) { this.turn += dt / .5; if (this.turn >= .5) this.facing = this.turnTo; if (this.turn >= 1) this.turn = 0; }
    this.pitch = follow(this.pitch, clamp(Math.atan2(this.vy, Math.abs(this.vx) + L * .3), -.35, .35), 3, dt);
    // Fins: thrust drives the tail; slow fish row with their pectorals.
    const pace = Math.hypot(this.vx, this.vy) / cruise, push = Math.max(0, ax * this.facing) / accel;
    let beat = clamp(.14 + pace * .5 + push * .7 + this.burst * .5, .12, 1);
    if (s.propulsion === "pectoral") beat *= pace > 1.1 ? .9 : .35;
    if (s.propulsion === "fins") beat *= pace > 1.2 ? .8 : .15;
    this.beat = follow(this.beat, beat, 4, dt);
    this.tail += TAU * (1 + 2.4 * this.beat * (s.wiggle ? 1.45 : 1)) * dt;
    const rowing = pace < .4 || s.propulsion !== "tail";
    this.paddle = follow(this.paddle, rowing ? 1 : .35, 3, dt);
    this.fin += TAU * (rowing ? 2.2 : 1.1) * dt;
    this.breath += TAU * 1.2 * dt;
    if (s.burst) { this.burst = follow(this.burst, 0, 1.4, dt); if (this.mode === "swim" && this.rand() < dt * .45) this.burst = 1; }
    this.gape = Math.max(0, this.gape - dt * 3);
    this.lookX = s.curious ? noise(this.seed + 11, t * .5) : .2; this.lookY = s.curious ? noise(this.seed + 13, t * .4) : 0;
  }

  draw(c, world) {
    const L = this.size(world), haze = this.z * .5;
    c.save();
    c.translate(this.x, this.y);
    if (!this.turn) {
      c.scale(this.facing, 1);
      c.rotate(this.pitch + (this.spec.wiggle ? Math.sin(this.tail) * .05 * this.beat : 0));
      c.scale(L, L);
      draw(c, this.look, this.shape, this, haze, L);
    } else {
      // Turning, the body bends: the head swings round first and the tail
      // follows, each half foreshortened as it points toward us.
      const p = this.turn, bend = (from) => { const v = Math.cos(Math.PI * clamp(p * 1.5 - from, 0, 1)); return Math.sign(v || 1) * Math.max(.16, Math.abs(v)); };
      c.scale(this.turnFrom, 1);
      c.rotate(this.pitch);
      for (const [half, scale] of [[-1, bend(.5)], [1, bend(0)]]) {
        c.save(); c.scale(scale * L, L);
        c.beginPath(); c.rect(half < 0 ? -2 : 0, -2, 2, 4); c.clip();
        draw(c, this.look, this.shape, this, haze, L);
        c.restore();
      }
    }
    c.restore();
  }

  // portrait paints a still fish filling a w × h box.
  static portrait(c, spec, w, h) {
    const look = LOOKS[spec.id] || PLAIN, s = shape(look), b = s.bounds;
    const L = Math.min(w * .92 / (b.x1 - b.x0), h * .9 / (b.y1 - b.y0));
    c.save(); c.translate(w / 2 - (b.x0 + b.x1) / 2 * L, h / 2 - (b.y0 + b.y1) / 2 * L); c.scale(L, L);
    draw(c, look, s, { ...STILL, colors: spec.colors }, 0, L);
    c.restore();
  }
}
```

- [ ] **Step 4: 写 `web/creatures/species.js`（先只注册鱼）**

```js
import { Fish } from "./fish.js";

// Every creature's model and habits. Lengths are in centimeters: the fish
// keep their true proportions, the bigger ones sized as young fish so
// nobody fills the tank; shrimp and crabs are drawn about half again their
// size so they stay readable on the sand. Colors are
// the species' own, a little muted to suit the quiet page. The ids match
// the visitor list in state.go.
const MODELS = { fish: Fish };

export const SPECIES = {
  // Lyretail anthias (sea goldfish), the resident who is always home.
  resident: { id: "resident", model: "fish", length: 8.5, zone: [.16, .6], speed: 1.1, hover: .35, burst: true, upstream: true, propulsion: "tail",
    colors: { back: "#df7a3e", flank: "#f09a54", belly: "#f8cf99", fin: "#f4a24f", iris: "#e9b45a" } },
  clown: { id: "clown", model: "fish", length: 7, zone: [.3, .85], speed: .9, hover: .5, home: true, wiggle: true, propulsion: "tail",
    colors: { back: "#dc6624", flank: "#ee8538", belly: "#f6a255", fin: "#ee8a3c", iris: "#f0a54a" } },
  tang: { id: "tang", model: "fish", length: 9.5, zone: [.12, .72], speed: 1, hover: .2, propulsion: "pectoral",
    colors: { back: "#1e4ead", flank: "#3367c6", belly: "#6c95d6", fin: "#2c5ab6", iris: "#22283a" } },
  angel: { id: "angel", model: "fish", length: 10, zone: [.38, .8], speed: .65, hover: .45, propulsion: "tail",
    colors: { back: "#2b6d80", flank: "#4f9a8e", belly: "#a7c77d", fin: "#3a8fa3", iris: "#d8b450" } },
  puffer: { id: "puffer", model: "fish", length: 6.5, zone: [.48, .88], speed: .5, hover: .6, curious: true, propulsion: "fins",
    colors: { back: "#e8d8be", flank: "#f2eadb", belly: "#fbf7ef", fin: "#f1dfab", iris: "#7dc6b4" } },
  cleaner: { id: "cleaner", model: "shrimp", length: 6.5, speed: .55, range: .12, rock: true, idle: 1.4 },
  fire: { id: "fire", model: "shrimp", length: 6, speed: .5, range: .1, rock: true, idle: 2 },
  harlequin: { id: "harlequin", model: "shrimp", length: 5.5, speed: .3, range: .14, rock: true, idle: 1.5 },
  pistol: { id: "pistol", model: "shrimp", length: 5.5, speed: .6, range: .08, burrow: true, idle: .8 },
  mantis: { id: "mantis", model: "mantis", length: 11, speed: .7, range: .14, burrow: true, idle: 1 },
  slipper: { id: "slipper", model: "shrimp", length: 9, speed: .25, range: .2, depths: [.15, .7], idle: 2.5 },
  hermit: { id: "hermit", model: "hermit", length: 4.5, speed: .45, range: .22, depths: [.1, .75], idle: 1.2 },
  emerald: { id: "emerald", model: "crab", length: 5.5, speed: .45, range: .1, rock: true, sideways: true, idle: 1.6 },
  porcelain: { id: "porcelain", model: "crab", length: 3.6, speed: .4, range: .06, rock: true, sideways: true, idle: 3 },
  arrow: { id: "arrow", model: "crab", length: 8, speed: .9, range: .14, rock: true, idle: 1.2 },
  swimmer: { id: "swimmer", model: "crab", length: 9, speed: .6, range: .25, depths: [.1, .7], sideways: true, idle: 1.4 },
};

// create returns a new creature, or null for an unknown species or one
// whose model is missing.
export function create(id, world, options) {
  const spec = SPECIES[id], Model = spec && MODELS[spec.model];
  return Model ? new Model(spec, world, options) : null;
}

// drawPortrait paints a still picture of a species into a canvas for the
// visitor book; unknown species get a plain silhouette.
export function drawPortrait(canvas, id) {
  const ratio = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
  canvas.width = Math.ceil(w * ratio); canvas.height = Math.ceil(h * ratio);
  const c = canvas.getContext("2d");
  c.setTransform(ratio, 0, 0, ratio, 0, 0);
  c.clearRect(0, 0, w, h);
  const spec = SPECIES[id], Model = spec && MODELS[spec.model];
  if (Model) { Model.portrait(c, spec, w, h); return; }
  c.fillStyle = "rgba(158,189,189,.35)";
  c.beginPath(); c.ellipse(w * .46, h / 2, w * .28, h * .2, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(w * .7, h / 2); c.lineTo(w * .86, h * .3); c.lineTo(w * .86, h * .7); c.fill();
}
```

- [ ] **Step 5: 改写 `web/reef.js`**

用下面的内容整个替换 `web/reef.js`：

```js
import { create } from "./creatures/species.js";
import { clamp, random } from "./creatures/motion.js";

// How far back each planted spot sits, so fish can pass in front of some
// plants and behind others.
const PLANT_DEPTH = [.55, .2, .7, .35, .85, .15, .6, .4];

export class Reef {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = null;
    this.time = 0;
    this.last = 0;
    this.frame = null;
    this.creatures = new Map();
    this.populated = false;
    this.newest = "";
    this.pellets = [];
    this.feedUntil = 0;
    this.nextSwap = 150;
    this.plants = [];
    this.rocks = [];
    this.rand = random(20261015);
    this.world = {
      width: 1, height: 1, px: 5, time: 0, still: false, fish: [], pellets: this.pellets, meal: 0, rocks: this.rocks, burrows: {},
      ground: (x, z) => this.ground(x, z),
      surface: (x, z) => this.surface(x, z),
      home: () => this.home(),
      eat: pellet => { pellet.eaten = true; },
    };
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", () => this.schedule());
    this.motion.addEventListener("change", () => this.schedule());
    this.resize();
    this.schedule();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const oldWidth = this.width || 1, oldHeight = this.height || 1;
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const scale = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.ceil(this.width * scale);
    this.canvas.height = Math.ceil(this.height * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.layout();
    for (const creature of this.creatures.values()) creature.resize(this.width / oldWidth, this.height / oldHeight, this.world);
    if (this.populated) this.arrange(false, this.world.still);
    this.draw();
  }

  // layout measures the sand, rocks and burrows for the current size.
  layout() {
    const w = this.width, h = this.height, world = this.world;
    world.width = w; world.height = h;
    world.px = clamp(h / 48, 4.2, 6.5);
    // The front sand bank, sampled from the same curve draw() fills.
    this.sand = [];
    for (let i = 0; i <= 64; i++) {
      const t = i / 64, u = 1 - t;
      this.sand.push([3 * u * u * t * w * .4 + 3 * u * t * t * w * .62 + t * t * t * w, u * u * u * (h - 17) + 3 * u * u * t * (h - 43) + 3 * u * t * t * (h - 17) + t * t * t * (h - 25)]);
    }
    this.rocks.length = 0;
    this.rocks.push(
      { x: w * .81, y: h - 25, rx: 28, ry: 14, angle: -.15, color: "#6d8179", z: .4 },
      { x: w * .85, y: h - 20, rx: 17, ry: 10, angle: .2, color: "#82948a", z: .3 },
      { x: w * .45, y: h - 23, rx: 23, ry: 12, angle: .1, color: "#6d8179", z: .45 },
      { x: w * .42, y: h - 19, rx: 14, ry: 9, angle: -.25, color: "#82948a", z: .35 },
    );
    world.burrows.mantis = { x: w * .6, z: .3 };
    world.burrows.pistol = { x: w * .7, z: .55 };
    for (const b of Object.values(world.burrows)) b.y = this.ground(b.x, b.z);
    this.plantBed();
  }

  // ground is the sand's surface at x; nearer things (smaller z) stand lower.
  ground(x, z) {
    const s = this.sand;
    let i = 1;
    while (i < s.length - 1 && s[i][0] < x) i++;
    const [x0, y0] = s[i - 1], [x1, y1] = s[i];
    const top = y0 + (y1 - y0) * clamp((x - x0) / (x1 - x0 || 1), 0, 1);
    return top + (1 - clamp(z, 0, 1)) * clamp((this.height - top) * .5, 4, 14);
  }

  // surface is where a crawler at depth z stands: on a rock at its depth, or the sand.
  surface(x, z) {
    let y = this.ground(x, z);
    for (const r of this.rocks) {
      if (Math.abs(r.z - z) > .16) continue;
      const u = (x - r.x) / (r.rx * .9);
      if (Math.abs(u) < 1) y = Math.min(y, r.y - r.ry * .92 * Math.sqrt(1 - u * u) + 1);
    }
    return y;
  }

  // plantBed lays out the plants that the completed rounds have grown.
  plantBed() {
    const growth = this.state?.completed || 0, w = this.width;
    this.plants = [];
    if (growth <= 0) return;
    const count = Math.min(8, 1 + Math.floor((growth - 1) / 3));
    for (let i = 0; i < count; i++) {
      const progress = Math.min(3, Math.max(1, growth - i * 3));
      this.plants.push({ x: w * (.09 + ((i * .137) % .71)), height: 28 + progress * 18, seed: i, coral: i > 0 && i % 3 === 0, z: PLANT_DEPTH[i] });
    }
  }

  // home is where the clownfish lives: the plant nearest the middle, or the big rock.
  home() {
    let best = null;
    for (const p of this.plants) if (!best || Math.abs(p.x - this.width * .5) < Math.abs(best.x - this.width * .5)) best = p;
    return best ? { x: best.x, y: this.height - 25 - best.height * .55 } : { x: this.rocks[0].x - 20, y: this.height - 70 };
  }

  update(state) {
    const oldFed = this.state?.fedSession;
    this.state = state;
    this.plantBed();
    this.populate();
    if (oldFed !== undefined && state.fedSession !== oldFed && state.fedSession && !this.world.still) this.feed();
    this.draw();
  }

  // populate adds a creature for the resident and every visitor met so far;
  // visitors who arrive while the page is open swim or walk in from the side.
  populate() {
    const visitors = this.state?.visitors || [];
    const enter = this.populated && !this.world.still;
    for (const id of ["resident", ...visitors.map(v => v.species)]) {
      if (this.creatures.has(id)) continue;
      const creature = create(id, this.world, { enter });
      if (creature) this.creatures.set(id, creature);
    }
    let newest = null;
    for (const v of visitors) if (!newest || v.date > newest.date) newest = v;
    this.newest = newest?.species || "";
    this.arrange(false, !this.populated || this.world.still);
    this.populated = true;
  }

  // arrange keeps a few crawlers out and the rest resting at home: one for
  // every 120 pixels of width, three to five. The newest visitor stays out.
  // A swap sends one home and lets another out.
  arrange(swap, instant) {
    const crawlers = [...this.creatures.values()].filter(c => c.crawler);
    if (!crawlers.length) return;
    const limit = clamp(Math.floor(this.width / 120), 3, 5);
    const newest = this.creatures.get(this.newest);
    let out = crawlers.filter(c => c.active), resting = null;
    if (swap && crawlers.length > limit) {
      const leaving = out.filter(c => c !== newest);
      if (leaving.length) { resting = leaving[Math.floor(this.rand() * leaving.length)]; resting.setActive(false, this.world, instant); out = out.filter(c => c !== resting); }
    }
    if (newest?.crawler && !newest.active) { newest.setActive(true, this.world, instant); out.push(newest); }
    while (out.length > limit) { const c = out.find(o => o !== newest); c.setActive(false, this.world, instant); out = out.filter(o => o !== c); }
    // Let out whoever lives farthest from the others already out, so the
    // sand doesn't crowd in one spot.
    const waiting = crawlers.filter(c => !c.active && c !== resting);
    while (out.length < limit && waiting.length) {
      const room = c => Math.min(Infinity, ...out.map(o => Math.abs(o.home.x - c.home.x))) + this.rand() * this.width * .15;
      waiting.sort((a, b) => room(b) - room(a));
      const c = waiting.shift(); c.setActive(true, this.world, instant); out.push(c);
    }
  }

  // feed scatters pellets near the surface; they sink slowly and drift.
  feed() {
    const r = this.rand, x = this.width * (.3 + r() * .4);
    this.pellets.length = 0;
    for (let i = 0; i < 12; i++) this.pellets.push({ x: x + (r() - .5) * this.width * .16, y: this.height * (.03 + r() * .06), vy: this.height * (.06 + r() * .03), seed: r() * 9, z: .15 + r() * .5, alpha: 1 });
    this.feedUntil = this.time + 20;
    this.world.meal++;
  }

  schedule() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.world.still = this.motion.matches;
    if (document.hidden || this.motion.matches) { this.draw(); return; }
    this.last = 0;
    const animate = (now) => {
      this.frame = requestAnimationFrame(animate);
      if (this.last && now - this.last < 1000 / 24) return;
      const delta = this.last ? Math.min((now - this.last) / 1000, .15) : 0;
      this.last = now;
      this.time += delta;
      this.step(delta);
      this.draw();
    };
    this.frame = requestAnimationFrame(animate);
  }

  step(dt) {
    const world = this.world;
    world.time = this.time;
    world.fish.length = 0;
    for (const c of this.creatures.values()) if (!c.crawler) world.fish.push(c);
    if (this.time > this.nextSwap) { this.nextSwap = this.time + 120 + this.rand() * 120; this.arrange(true, false); }
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const p = this.pellets[i];
      if (p.eaten || p.alpha <= 0) { this.pellets.splice(i, 1); continue; }
      if (!p.landed) {
        p.y += p.vy * dt; p.x += Math.sin(this.time * 1.3 + p.seed) * 5 * dt;
        const floor = this.ground(p.x, p.z);
        if (p.y >= floor) { p.y = floor; p.landed = true; }
      }
      if (this.time > this.feedUntil) p.alpha -= dt;
    }
    for (const c of this.creatures.values()) c.step(dt, world);
  }

  plant(x, height, seed, coral = false) {
    const c = this.ctx, h = this.height;
    const sway = Math.sin(this.time * .5 + seed) * 5;
    c.save(); c.translate(x, h - 25);
    c.lineCap = "round";
    if (coral) {
      c.strokeStyle = "#bd918c"; c.lineWidth = 4;
      for (let i = 0; i < 5; i++) {
        const side = i % 2 ? 1 : -1, y = -height * (.3 + i * .14);
        c.beginPath(); c.moveTo(0, 2); c.quadraticCurveTo(sway / 3, -height / 2, sway, -height); c.stroke();
        c.beginPath(); c.moveTo(sway * .3, y + 12); c.quadraticCurveTo(side * 15, y, side * 18, y - 18); c.stroke();
      }
    } else {
      c.strokeStyle = seed % 2 ? "#529a86" : "#70af91"; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-8, -height / 3, 10 + sway, -height * .7, sway, -height); c.stroke();
      for (let i = 0; i < 4; i++) {
        const y = -height * (.2 + i * .19), side = i % 2 ? 1 : -1;
        c.fillStyle = i % 2 ? "#79b89b" : "#568d7c";
        c.beginPath(); c.moveTo(sway * .2, y); c.quadraticCurveTo(side * 25, y - 3, side * 16 + sway, y - 22); c.quadraticCurveTo(side * 2, y - 17, sway * .2, y); c.fill();
      }
    }
    c.restore();
  }

  rock(r) {
    const c = this.ctx;
    c.fillStyle = r.color; c.beginPath(); c.ellipse(r.x, r.y, r.rx, r.ry, r.angle, 0, Math.PI * 2); c.fill();
  }

  draw() {
    if (!this.ctx) return;
    const c = this.ctx, w = this.width, h = this.height, t = this.time;
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#b4cfb114";
    for (let i = 0; i < 18; i++) {
      const y = h - ((t * (7 + i % 3) + i * 27) % (h + 30));
      const x = (i * 43 + 21) % w + Math.sin(t * .2 + i) * 8;
      c.beginPath(); c.arc(x, y, 1 + i % 2, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = "#53675a"; c.beginPath(); c.moveTo(0, h);
    c.lineTo(0, h - 28); c.bezierCurveTo(w * .25, h - 53, w * .7, h - 7, w, h - 34); c.lineTo(w, h); c.fill();
    c.fillStyle = "#718371"; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h - 17); c.bezierCurveTo(w * .4, h - 43, w * .62, h - 17, w, h - 25); c.lineTo(w, h); c.fill();
    for (let i = 0; i < 25; i++) { c.fillStyle = i % 2 ? "#899781" : "#566c5e"; c.beginPath(); c.ellipse((i * 71 + 14) % w, h - 8 - i % 19, 1.5, 1, 0, 0, Math.PI * 2); c.fill(); }
    // Mature reefs keep changing their bed color and gentle lighting.
    if ((this.state?.completed || 0) >= 24) { c.fillStyle = "#a8deba08"; c.fillRect(0, 0, w, h); }
    for (const creature of this.creatures.values()) creature.under?.(c, this.world);
    // Rocks, plants and creatures share one depth order, farthest first.
    const scene = [];
    for (const r of this.rocks) scene.push([r.z, 0, r]);
    for (const p of this.plants) scene.push([p.z, 1, p]);
    for (const creature of this.creatures.values()) scene.push([creature.z, 2, creature]);
    scene.sort((a, b) => b[0] - a[0]);
    for (const [, kind, item] of scene) {
      if (kind === 0) this.rock(item);
      else if (kind === 1) this.plant(item.x, item.height, item.seed, item.coral);
      else item.draw(c, this.world);
    }
    for (const p of this.pellets) {
      const r = 1.7 * (1 - .3 * p.z);
      c.fillStyle = `rgba(226,194,148,${p.alpha})`; c.beginPath(); c.arc(p.x, p.y - r * .6, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = `rgba(255,240,214,${.6 * p.alpha})`; c.beginPath(); c.arc(p.x - r * .3, p.y - r, r * .4, 0, Math.PI * 2); c.fill();
    }
  }
}
```

- [ ] **Step 6: 验收**

1. 重新打开第 2 步的页面（`?v=clown,tang,angel,puffer,cleaner,hermit&g=6`），在控制台执行 `errors`。Expected：`[]`，也就是虾蟹的模型还没注册时不报错，直接跳过。
2. `?gallery=resident,clown,tang,angel,puffer&w=420&h=250`：五种鱼各自的体型和花纹与设计文档“外观要点”一致；鳍半透明、有鳍条；眼睛有虹膜和高光；身上有淡淡的鳞纹。
3. `turn.html?id=clown`：第一行头先转过来、尾巴后跟，中途身体对折；第二行尾鳍宽窄变化，没有上下甩动。
4. `?v=clown,tang,angel,puffer&g=14`，执行下面的脚本记录 12 秒的运动：

```js
(() => {
  pause(); const r = reefs[0]; let worst = 9, close = 0; const modes = new Set();
  for (let i = 0; i < 24 * 300; i++) {
    r.time += 1 / 24; r.step(1 / 24);
    const cs = [...r.creatures.values()]; let near = false;
    for (const c of cs) modes.add(c.mode);
    for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
      const A = cs[a], B = cs[b]; if (Math.abs(A.z - B.z) > .25) continue;
      const d = Math.hypot(A.x - B.x, A.y - B.y) / ((A.size(r.world) + B.size(r.world)) / 2);
      worst = Math.min(worst, d); if (d < .8) near = true;
    }
    if (near) close++;
  }
  return { worst, framesUnder08: close, modes: [...modes] };
})()
```

   这段脚本快进 5 分钟。Expected：`modes` 里既有 `swim` 也有 `hover`；深度相近（`|Δz| ≤ .25`）的两条鱼，中心距离不小于平均体长的约 0.75 倍。实测 `worst` 为 0.76，低于 0.8 的只有 12 帧（共 7200 帧）。离得太近时，鱼会一前一后错开深度经过。
5. 执行 `feed()`，等 15 秒。Expected：鱼游向鱼食、一粒一粒吃掉，吃的时候嘴张开一下。
6. 浏览器模式打开 `four` 存档：图鉴仍是 4 位访客，水缸里 5 条鱼，控制台没有报错。

- [ ] **Step 7: Commit**

```bash
git add web/creatures/fish.js web/creatures/species.js web/reef.js
git commit -m "feat(aquarium): draw lifelike fish in a depth-sorted reef"
```

### Task 3: 小虾与琵琶虾

**Files:**
- Create: `web/creatures/shrimp.js`
- Modify: `web/creatures/species.js`

**Interfaces:**
- Consumes: `Crawler`、`Gait`、`knee`、`noise`、`follow`、`clamp`、`lerp`、`TAU`；`paint.js` 的 `curve`、`dot`、`limb`、`oval`、`shadow`、`tone`、`wind`、`hole`、`lip`；场景的 `world.burrows.pistol`。
- Produces: `class Shrimp extends Crawler`，有 `startle(world)`、`step(dt, world)`、`under(c, world)`（枪虾的洞口）、`draw(c, world)`、`static portrait(c, spec, w, h)`。

- [ ] **Step 1: 写 `web/creatures/shrimp.js`**

```js
import { curve, dot, hole, limb, lip, oval, shade, shadow, tone, wind } from "./paint.js";
import { Crawler, Gait, TAU, clamp, follow, knee, lerp, noise } from "./motion.js";

// Shrimp are drawn facing right in units of body length, standing on the
// ground at y = 0 with the carapace raised on their legs. The abdomen is a
// chain of six segments that arches over the back and curls under for an
// escape flip; the tail fan opens at its end.
const SHAPES = {
  // Lysmata and its relatives: a slim body with a hump in the abdomen.
  slim: {
    carapace: [[.42, -.215], [.34, -.275], [.2, -.3], [.06, -.29], [-.01, -.255], [-.02, -.17], [.06, -.135], [.2, -.128], [.33, -.142], [.41, -.18]],
    rostrum: [[.36, -.258], [.53, -.282], [.4, -.225]],
    waist: [0, -.215], segments: [[.085, .16], [.08, .165], [.075, .15], [.07, .13], [.065, .105], [.075, .08]],
    arch: [.3, .1, -.3, -.34, -.24, -.12], fan: .12,
    hips: [[.34, -.14], [.28, -.135], [.21, -.13], [.14, -.13], [.07, -.135]], rests: [.44, .32, .2, .09, -.02], upper: .085, lower: .1,
    eye: [.38, -.25, .034], antenna: [.39, -.22], mouth: [.43, -.15],
  },
  // The harlequin shrimp is short and deep, carrying two flat claws.
  stocky: {
    carapace: [[.38, -.2], [.32, -.29], [.18, -.32], [.04, -.3], [-.02, -.26], [-.03, -.15], [.06, -.12], [.2, -.115], [.32, -.13], [.38, -.16]],
    rostrum: [[.33, -.25], [.43, -.27], [.36, -.22]],
    waist: [-.01, -.215], segments: [[.08, .19], [.075, .19], [.07, .17], [.065, .145], [.06, .115], [.065, .09]],
    arch: [.24, .08, -.26, -.3, -.24, -.12], fan: .11,
    hips: [[.31, -.125], [.25, -.12], [.18, -.115], [.11, -.115], [.04, -.12]], rests: [.4, .29, .18, .07, -.04], upper: .075, lower: .085,
    eye: [.35, -.24, .032], antenna: [.36, -.21], mouth: [.4, -.14],
  },
  // The pistol shrimp is stockier, with its eyes under a hood.
  stout: {
    carapace: [[.4, -.2], [.33, -.26], [.2, -.28], [.06, -.27], [-.01, -.24], [-.02, -.15], [.06, -.12], [.2, -.115], [.32, -.13], [.4, -.165]],
    rostrum: [[.36, -.235], [.44, -.24], [.38, -.205]],
    waist: [0, -.2], segments: [[.08, .15], [.08, .155], [.075, .15], [.07, .135], [.065, .115], [.07, .09]],
    arch: [.22, .06, -.22, -.26, -.2, -.1], fan: .11,
    hips: [[.32, -.125], [.26, -.12], [.2, -.115], [.13, -.115], [.06, -.12]], rests: [.42, .31, .19, .08, -.03], upper: .08, lower: .09,
    eye: [.37, -.215, .026], antenna: [.38, -.2], mouth: [.42, -.14],
  },
  // The slipper lobster is flat and drawn a little from above (see paintSlipper);
  // only its legs use this side-view layout.
  flat: {
    hips: [[.3, -.04], [.22, -.04], [.14, -.04], [.06, -.04], [-.02, -.04]], rests: [.34, .25, .16, .07, -.02], upper: .04, lower: .045,
    mouth: [.4, -.06],
  },
};

const LOOKS = {
  cleaner: { shape: "slim", whip: 2.3, colors: { body: "#f1b744", belly: "#e7a53b", band: "#c7302a", stripe: "#f7f2e8", leg: "#efe6d8", fan: "#c7302a", whip: "#f4efe6" } },
  fire: { shape: "slim", whip: 2, colors: { body: "#b81e25", belly: "#a11a20", band: "#b81e25", leg: "#f1e9de", fan: "#b81e25", whip: "#f4efe6", spots: "#f7efe5" } },
  harlequin: { shape: "stocky", whip: .3, colors: { body: "#f3ebdc", belly: "#e8dccb", leg: "#efe3d6", fan: "#f1e6d6", whip: "#ead9c9", patch: "#c64c86", edge: "#6d2f62" } },
  pistol: { shape: "stout", whip: .9, colors: { body: "#ecdfc6", belly: "#dcc9aa", leg: "#e6c7a0", fan: "#e3cfb1", whip: "#d58a52", patch: "#b4642c" } },
  slipper: { shape: "flat", whip: 0, colors: { body: "#a58260", belly: "#8a6a4c", leg: "#8a6a4c", fan: "#9b7a58", patch: "#5f4734", plate: "#9a7856" } },
};

// pose lays out the abdomen chain for a given curl (0 relaxed … 1 tucked).
function chain(shape, curl) {
  const out = [];
  let [x, y] = shape.waist, a = Math.PI;
  shape.segments.forEach(([len, h], i) => {
    a += shape.arch[i] - curl * (.22 + i * .07);
    const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
    out.push({ x, y, nx, ny, a, h, ux: -Math.sin(a), uy: Math.cos(a) });
    x = nx; y = ny;
  });
  return out;
}

// paintShrimp draws a shrimp in unit space. pose has the feet in unit
// coordinates, the curl, antenna angles and the claws' work.
function paintShrimp(c, id, pose, haze, L) {
  const look = LOOKS[id], shape = SHAPES[look.shape], C = look.colors, hair = 1 / L, col = shade(haze);
  if (id === "slipper") { paintSlipper(c, pose, col, C, hair); return; }
  const segs = chain(shape, pose.curl);
  const tail = segs[segs.length - 1];
  // Far side first: the far antenna and legs, darker and a little higher.
  if (look.whip) whip(c, shape.antenna, pose.whip2, look.whip * .95, col(C.whip, .55, -.25), hair * .7);
  legs(c, shape, pose.far, col(C.leg, .75, -.35), hair * 1.2);
  // Swimmerets beat under the abdomen.
  c.strokeStyle = col(C.leg, .7, -.1); c.lineCap = "round"; c.lineWidth = hair * 1.4;
  segs.slice(0, 5).forEach((s, i) => {
    const mx = (s.x + s.nx) / 2 - s.ux * s.h * .45, my = (s.y + s.ny) / 2 - s.uy * s.h * .45, swing = Math.sin(pose.paddle - i * .8) * .5;
    c.beginPath(); c.moveTo(mx, my); c.lineTo(mx - s.ux * .07 + Math.cos(s.a + swing) * .03, my - s.uy * .07 + Math.sin(s.a + swing) * .03); c.stroke();
  });
  // Tail fan: the telson with a uropod on each side.
  const fanA = tail.a + .05, open = shape.fan * (1 + pose.curl * .3);
  for (const [da, len, w] of [[.32 + pose.curl * .3, 1, .38], [-.3 - pose.curl * .3, 1, .38], [0, 1.05, .28]]) {
    c.fillStyle = col(C.fan, .82, da ? 0 : -.1);
    oval(c, tail.nx + Math.cos(fanA + da) * open * len * .5, tail.ny + Math.sin(fanA + da) * open * len * .5, open * len * .55, open * w * .5, fanA + da);
  }
  // Body: carapace and abdomen as one shape, so markings run across them.
  const body = new Path2D();
  curve(body, wind(shape.carapace), true);
  if (shape.rostrum) curve(body, wind(shape.rostrum), true);
  const top = segs.map(s => [s.x + s.ux * s.h / 2, s.y + s.uy * s.h / 2]), under = [];
  for (const s of segs) under.push([s.x - s.ux * s.h / 2, s.y - s.uy * s.h / 2], [(s.x + s.nx) / 2 - s.ux * s.h * .58, (s.y + s.ny) / 2 - s.uy * s.h * .58]);
  top.push([tail.nx + tail.ux * tail.h * .42, tail.ny + tail.uy * tail.h * .42]); under.push([tail.nx - tail.ux * tail.h * .42, tail.ny - tail.uy * tail.h * .42]);
  curve(body, wind([...top, ...under.reverse()]), true);
  const g = c.createLinearGradient(0, -.33, 0, -.1);
  g.addColorStop(0, col(C.body, .96, .06)); g.addColorStop(1, col(C.belly, .92, -.05));
  c.fillStyle = g; c.fill(body);
  c.save(); c.clip(body);
  const back = [[.4, -.27], [.2, -.31], [.04, -.29], ...segs.map(s => [s.nx + s.ux * s.h * .38, s.ny + s.uy * s.h * .38])];
  if (C.band !== C.body && C.band) {
    c.strokeStyle = col(C.band); c.lineWidth = .1; c.lineJoin = "round"; c.beginPath(); curve(c, back.map(([x, y]) => [x, y + .02])); c.stroke();
    c.strokeStyle = col(C.stripe); c.lineWidth = .02; c.beginPath(); curve(c, back.map(([x, y]) => [x, y + .012])); c.stroke();
  }
  if (C.spots) { c.fillStyle = col(C.spots, .9); for (const [x, y, r] of [[.3, -.23, .014], [.22, -.2, .01], [.14, -.24, .012], [.06, -.19, .011], [.25, -.16, .009]]) dot(c, x, y, r); for (const s of segs) dot(c, (s.x + s.nx) / 2 + s.ux * .02, (s.y + s.ny) / 2 + s.uy * .02, .012); }
  if (id === "harlequin") {
    for (const [x, y, r] of [[.3, -.22, .045], [.13, -.24, .05], ...segs.filter((_, i) => i % 2 === 0).map(s => [(s.x + s.nx) / 2, (s.y + s.ny) / 2, .045])]) {
      c.fillStyle = col(C.edge, .9); dot(c, x, y, r + .012); c.fillStyle = col(C.patch); dot(c, x, y, r);
    }
  }
  if (id === "pistol") { c.fillStyle = col(C.patch, .85); for (const s of segs) oval(c, (s.x + s.nx) / 2 + s.ux * .02, (s.y + s.ny) / 2 + s.uy * .02, .03, .05, s.a); oval(c, .2, -.22, .07, .04, -.1); oval(c, .06, -.2, .04, .05); }
  // Joints between segments and the light from above.
  c.strokeStyle = col(C.body, .4, -.45); c.lineWidth = hair * .8;
  for (const s of segs) { c.beginPath(); c.moveTo(s.x + s.ux * s.h * .55, s.y + s.uy * s.h * .55); c.quadraticCurveTo(s.x + Math.cos(s.a) * .015, s.y + Math.sin(s.a) * .015, s.x - s.ux * s.h * .6, s.y - s.uy * s.h * .6); c.stroke(); }
  const light = c.createLinearGradient(0, -.33, 0, -.08);
  light.addColorStop(0, `rgba(255,255,255,${.3 * (1 - haze)})`); light.addColorStop(.45, "rgba(255,255,255,0)"); light.addColorStop(1, "rgba(0,18,24,.25)");
  c.fillStyle = light; c.fillRect(-.6, -.4, 1.2, .4);
  c.restore();
  // Near legs, claws, antennae and the eye.
  legs(c, shape, pose.near, col(C.leg, .78), hair * 1.35);
  if (id === "harlequin") petals(c, pose, col, C);
  if (id === "pistol") snapper(c, pose, col, C, hair);
  if (shape.antenna) {
    const [ax, ay] = shape.antenna;
    c.strokeStyle = col(C.whip, .9); c.lineWidth = hair * .9;
    for (const lift of [-.5, -.75]) { c.beginPath(); c.moveTo(ax + .01, ay - .02); c.quadraticCurveTo(ax + .1, ay - .08 + lift * .05, ax + .17, ay - .07 + lift * .12 + Math.sin(pose.paddle * .7 + lift) * .02); c.stroke(); }
    if (look.whip) whip(c, shape.antenna, pose.whip, look.whip, col(C.whip, .9), hair * .9);
  }
  const [ex, ey, er] = shape.eye;
  c.strokeStyle = col(C.body, .9, -.2); c.lineWidth = er * .9; c.beginPath(); c.moveTo(ex - .04, ey + .01); c.lineTo(ex, ey); c.stroke();
  c.fillStyle = col("#0d0a09", .95); dot(c, ex, ey, er);
  c.fillStyle = `rgba(255,255,255,${.75 * (1 - haze)})`; dot(c, ex + er * .3, ey - er * .35, er * .3);
  if (id === "pistol") { c.fillStyle = col(C.body, .45, .15); oval(c, ex - .004, ey - .012, er * 1.5, er * 1.15); }
}

// whip draws a long antenna that arcs forward and droops toward its tip.
function whip(c, [ax, ay], angle, length, color, width) {
  const tx = ax + Math.cos(angle) * length, ty = ay + Math.sin(angle) * length * .55 + length * .12;
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = "round";
  c.beginPath(); c.moveTo(ax, ay); c.bezierCurveTo(ax + Math.cos(angle - .35) * length * .35, ay + Math.sin(angle - .35) * length * .35, ax + Math.cos(angle - .1) * length * .7, ay + Math.sin(angle - .1) * length * .6, tx, ty); c.stroke();
}

// legs draws walking legs from their hips to the feet, knees raised.
function legs(c, shape, feet, color, width) {
  feet.forEach(([fx, fy], i) => {
    const [hx, hy] = shape.hips[i], [kx, ky] = knee(hx, hy, fx, fy, shape.upper, shape.lower);
    limb(c, [[hx, hy], [kx, ky], [fx, fy]], width, width * .7, color);
  });
}

// petals are the harlequin shrimp's flat, spotted claws held up in front.
function petals(c, pose, col, C) {
  for (const [dx, lift] of [[0, 0], [.03, .05]]) {
    c.save(); c.translate(.38 + dx, -.16); c.rotate(-.9 - lift + Math.sin(pose.paddle * .3) * .05 - pose.work * .3);
    c.fillStyle = col(C.body, .95, .05); oval(c, .14, 0, .14, .06);
    c.fillStyle = col(C.edge, .9); dot(c, .12, 0, .035); c.fillStyle = col(C.patch); dot(c, .12, 0, .026);
    c.fillStyle = col(C.edge, .9); dot(c, .22, .01, .02); c.fillStyle = col(C.patch); dot(c, .22, .01, .014);
    c.restore();
  }
}

// snapper is the pistol shrimp's big claw; its finger snaps shut.
function snapper(c, pose, col, C, hair) {
  c.save(); c.translate(.4, -.13); c.rotate(-.15 - pose.work * .25);
  limb(c, [[-.06, -.01], [.04, .02]], hair * 3, hair * 3, col(C.leg));
  c.fillStyle = col("#c9733a"); oval(c, .14, .01, .11, .05, -.05);
  c.fillStyle = col(C.patch, .9, -.15); oval(c, .12, .02, .05, .02);
  c.save(); c.translate(.24, -.01); c.rotate(-.5 * pose.open);
  c.fillStyle = col("#c9733a", 1, -.08); oval(c, .05, 0, .055, .018);
  c.restore();
  c.fillStyle = `rgba(255,255,255,${.25 * (1 - pose.haze)})`; oval(c, .13, -.015, .06, .012, -.05);
  c.restore();
}

// paintSlipper draws the slipper lobster from a little above: a broad flat
// shell shaped like a pipa, two shovel plates in front and a wide tail fan.
// The outline is laid out as seen from straight above (u along the body, v
// across it), squashed to the viewing angle, with its side showing below.
function paintSlipper(c, pose, col, C, hair) {
  const squash = .55, high = -.1;
  const plan = [[.4, -.04], [.4, -.2], [.36, -.255], [.28, -.27], [.14, -.255], [.02, -.225], [-.08, -.18], [-.2, -.155], [-.31, -.13], [-.39, -.11], [-.43, -.14], [-.5, -.2], [-.56, -.12], [-.58, -.04], [-.56, 0]];
  const outline = [...plan, ...plan.slice(0, -1).reverse().map(([u, v]) => [u, -v])];
  const place = (pts, dy = 0) => pts.map(([u, v]) => [u, high + v * squash + dy]);
  // Short legs poke out from under the shell.
  legs(c, SHAPES.flat, pose.far, col(C.leg, .7, -.3), hair * 1.3);
  // The side of the shell, then its top.
  c.fillStyle = col(C.belly, 1, -.25); c.fill(curve(new Path2D(), place(outline, .035), true));
  const top = curve(new Path2D(), place(outline), true);
  const g = c.createLinearGradient(0, high - .09, 0, high + .09);
  g.addColorStop(0, col(C.body, 1, .1)); g.addColorStop(1, col(C.body, 1, -.12));
  c.fillStyle = g; c.fill(top);
  c.save(); c.clip(top);
  c.fillStyle = col(C.patch, .5);
  for (const [u, v, r] of [[.25, -.13, .035], [.2, .1, .03], [.06, -.05, .04], [.3, .16, .028], [-.1, .09, .03], [-.2, -.07, .03], [-.3, .05, .025], [.12, .17, .022], [.34, -.03, .025]]) oval(c, u, high + v * squash, r, r * squash * 1.3);
  c.fillStyle = col("#e3cfae", .5);
  for (let i = 0; i < 18; i++) dot(c, .36 - (i * .029) % .42, high + ((i * 37) % 23 / 23 - .5) * .36 * squash, .007);
  // The carapace's rim and the abdomen's segment lines.
  c.strokeStyle = col(C.patch, .5); c.lineWidth = hair;
  c.beginPath(); curve(c, place([[.36, -.25], [.14, -.2], [.0, -.14], [-.03, 0], [.0, .14], [.14, .2], [.36, .25]])); c.stroke();
  for (const u of [-.1, -.18, -.26, -.34]) { c.beginPath(); curve(c, place([[u + .015, -.15], [u - .015, 0], [u + .015, .15]])); c.stroke(); }
  c.strokeStyle = col("#ead8b8", .4); c.lineWidth = hair * 1.4; c.beginPath(); curve(c, place([[.36, -.02], [.1, -.03], [-.36, -.015]])); c.stroke();
  c.restore();
  // The two shovel plates in front, with toothed edges.
  for (const side of [-1, 1]) {
    const plate = [[.39, side * .015], [.48, side * .02], [.56, side * .06], [.53, side * .1], [.57, side * .15], [.52, side * .22], [.45, side * .26], [.39, side * .24]];
    c.fillStyle = col(C.belly, 1, -.25); c.fill(curve(new Path2D(), place(plate, .03), true));
    c.fillStyle = col(C.plate, 1, side < 0 ? .08 : -.04); c.fill(curve(new Path2D(), place(plate), true));
    c.strokeStyle = col(C.patch, .55); c.lineWidth = hair; c.beginPath(); curve(c, place([[.41, side * .06], [.5, side * .12], [.52, side * .2]])); c.stroke();
  }
  // Eyes sit at the front corners of the shell.
  for (const side of [-1, 1]) { const [x, y] = place([[.37, side * .245]])[0]; c.fillStyle = col("#120d0a", .95); dot(c, x, y - .012, .02); c.fillStyle = "rgba(255,255,255,.6)"; dot(c, x + .006, y - .018, .007); }
  legs(c, SHAPES.flat, pose.near, col(C.leg, .9, -.1), hair * 1.5);
}

// Shrimp walk on legs that keep their footing, sway their antennae, beat
// their swimmerets, and flip backward with their tails when startled.
export class Shrimp extends Crawler {
  constructor(spec, world, options) {
    super(spec, world, options);
    const shape = SHAPES[LOOKS[spec.id].shape];
    this.legs = new Gait([...shape.rests.map((dx, i) => ({ dx, group: i % 2 })), ...shape.rests.map((dx, i) => ({ dx: dx - .05, group: 1 - i % 2, dz: .06 }))], { stride: .22, lift: .06, duration: .16 });
    this.curl = 0; this.dart = 0; this.hop = 0; this.whip = -.75; this.paddle = 0; this.work = 0; this.open = 0; this.snap = 0; this.buried = 0;
    this.carry = 0; this.piles = [];
  }

  settle(world) {
    super.settle(world);
    if (this.spec.burrow) { const b = world.burrows[this.spec.id]; this.home = this.den = { x: b.x, z: b.z }; this.depths = [Math.max(0, b.z - .1), b.z + .1]; this.hides = true; this.burrow = b; }
  }

  // The slipper lobster digs in where it rests instead of hiding.
  get resting() { return this.state === "in" && !this.hides; }

  startle(world) {
    // Burrowers and the shy fire shrimp go home for a while; the others flip away.
    if (this.spec.burrow || this.spec.id === "fire") { this.hideAway(8 + this.rand() * 10); return; }
    if (this.spec.id === "harlequin") { super.startle(world); return; }
    this.dart = 1; this.goal = null; this.until = world.time + 3;
    this.vx = -this.facing * this.size(world) * 7;
  }

  step(dt, world) {
    const L = this.size(world);
    if (this.dart > 0) {
      // Escape flip: the tail snaps under and the body darts backward.
      this.dart = Math.max(0, this.dart - dt * 2.2); this.busy = this.dart > 0;
      this.curl = Math.sin(Math.PI * Math.min(1, (1 - this.dart) * 1.6));
      this.hop = Math.sin(Math.PI * (1 - this.dart)) * L * .35;
      this.vx = follow(this.vx, 0, 3, dt);
      this.x = clamp(this.x, world.width * .02, world.width * .98);
    } else { this.busy = false; this.curl = follow(this.curl, 0, 6, dt); this.hop = 0; }
    this.routine(dt, world);
    if (this.dart > 0) this.legs.place(this.x, this.legScale(world), this.footing(world));
    else this.legs.update(dt, this.x, this.legScale(world), this.footing(world), this.vx);
    // Antennae trail the body a little and wave on their own; cleaners wave more.
    const wave = this.spec.id === "cleaner" ? .22 : .1;
    this.whip = follow(this.whip, -.7 + noise(this.seed, this.clock * .6) * wave - clamp(this.vx * this.facing / L, -1, 1) * .25, 5, dt);
    this.paddle += TAU * (this.state === "in" ? 1.2 : 2.4) * dt;
    this.work = this.eating > 0 ? .5 + Math.sin(this.clock * 9) * .5 : follow(this.work, 0, 4, dt);
    this.buried = follow(this.buried, this.resting ? 1 : 0, 1.2, dt);
    if (this.spec.id === "pistol") {
      // It bulldozes sand out of its burrow: carried in front of the claws on
      // the way out, dropped in a little heap where it stops.
      const b = this.burrow, outward = this.state === "out" && this.goal && !this.goal.food && Math.abs(this.goal.x - b.x) > Math.abs(this.x - b.x);
      if (this.carry > .6 && !outward && this.state === "out") { this.piles.push({ x: this.x + this.facing * L * .6, z: this.z, life: 1 }); this.carry = 0; }
      this.carry = follow(this.carry, outward ? 1 : 0, 2, dt);
      for (const p of this.piles) p.life -= dt / 12;
      this.piles = this.piles.filter(p => p.life > 0);
      if (this.state === "out" && !this.goal && this.rand() < dt * .08) this.snap = 1;
      this.snap = Math.max(0, this.snap - dt * 2.5);
      this.open = this.snap > .85 ? 1 : follow(this.open, this.snap > 0 ? 0 : .35, 12, dt);
    }
  }

  under(c, world) {
    if (!this.burrow) return;
    const b = this.burrow, r = this.spec.length * world.px * .55;
    hole(c, b.x, world.ground(b.x, b.z), r);
    for (const p of this.piles) { c.fillStyle = tone("#8f9d86", p.z * .5, p.life); oval(c, p.x, world.ground(p.x, p.z), r * .5, r * .2); }
  }

  draw(c, world) {
    if (this.hidden && !this.burrow) return;
    const L = this.size(world), haze = this.z * .5;
    const lift = this.hop + this.legs.airborne * L * .015;
    let sink = 0;
    if (this.burrow) {
      // Going home means backing down into the burrow, a little at a time.
      const b = this.burrow, near = 1 - clamp(Math.abs(this.x - b.x) / (L * .6), 0, 1);
      sink = this.state === "in" ? 1 - .35 * Math.max(0, noise(this.seed + 4, this.clock * .2)) : this.state === "leaving" ? near : 0;
      if (sink > .98) return;
    }
    if (this.buried > .01) sink = Math.max(sink, this.buried * .5);
    shadow(c, this.x, this.y + 1, L * .45, L * .1, .3 * (1 - sink) * this.shown * (1 - haze));
    c.save();
    c.globalAlpha = this.shown;
    c.translate(this.x, this.y - lift + sink * L * .32);
    if (sink > 0) { c.beginPath(); c.rect(-L * 3, -L * 3, L * 6, L * 3 - sink * L * .32 + 1); c.clip(); }
    c.scale(this.flipX * L, L);
    const feet = this.localFeet(L, lift);
    if (this.eating > 0 || this.work > .05) { const m = SHAPES[LOOKS[this.spec.id].shape].mouth; feet[0] = [lerp(feet[0][0], m[0] + .04, this.work), lerp(feet[0][1], m[1] + .02, this.work)]; }
    paintShrimp(c, this.spec.id, { near: feet.slice(0, 5), far: feet.slice(5), curl: this.curl, whip: this.whip, whip2: this.whip - .12, paddle: this.paddle, work: this.work, open: this.open, haze }, haze, L);
    c.restore();
    if (this.carry > .05) { c.fillStyle = tone("#8f9d86", haze, this.shown); oval(c, this.x + this.facing * L * .62, this.y - L * .035, L * .1 * this.carry, L * .055 * this.carry); }
    if (this.snap > .6) { c.fillStyle = `rgba(235,250,255,${(this.snap - .6) * 2})`; c.beginPath(); c.arc(this.x + this.facing * L * .7, this.y - L * .16, L * .08 + (1 - this.snap) * L * .3, 0, TAU); c.fill(); }
    if (this.burrow) { const b = this.burrow, r = this.spec.length * world.px * .55; lip(c, b.x, world.ground(b.x, b.z), r); }
    if (this.buried > .01) { c.fillStyle = tone("#718371", haze, this.buried); c.beginPath(); c.ellipse(this.x, this.y + 1, L * .6, L * .08, 0, 0, TAU); c.fill(); }
  }

  static portrait(c, spec, w, h) {
    const look = LOOKS[spec.id], shape = SHAPES[look.shape];
    const reach = look.whip ? .55 + look.whip * .15 : .55, L = Math.min(w * .92 / (.55 + reach), h * .82 / .42);
    c.save(); c.translate(w / 2 - (reach - .55) / 2 * L, h * .82); c.scale(L, L);
    const feet = shape.rests.map(dx => [dx, 0]);
    paintShrimp(c, spec.id, { near: feet, far: feet.map(([x, y]) => [x - .05, y - .015]), curl: 0, whip: -.62, whip2: -.75, paddle: 1, work: 0, open: .3, haze: 0 }, 0, L);
    c.restore();
  }
}
```

- [ ] **Step 2: 在 `web/creatures/species.js` 注册模型**

在 `import { Fish } from "./fish.js";` 之后的导入里追加：

```js
import { Shrimp } from "./shrimp.js";
```

并把

```js
const MODELS = { fish: Fish };
```

改成

```js
const MODELS = { fish: Fish, shrimp: Shrimp };
```

- [ ] **Step 3: 验收**

1. `?gallery=cleaner,fire,harlequin,pistol,slipper&w=420&h=250`：清洁虾背上是红带夹白线、两侧黄色、白色长须；火焰虾深红带白点；油彩蜡膜虾是奶白底上带深边的粉紫斑块，前面一对花瓣似的大螯；枪虾有一只橙色大螯，眼睛藏在头胸甲下；琵琶虾从斜上方看是扁平的琵琶形，头前两片宽板，眼睛在前缘两角。
2. `?v=cleaner,fire,harlequin,pistol,slipper&g=9`，执行 `pause(); ff(60)` 后截图：虾停在石头上或沙地上，腿着地、不悬空；枪虾在洞口附近；琵琶虾不在外面时半埋在沙里。`errors` 为 `[]`。
3. 执行下面的脚本，让鱼贴近清洁虾：

```js
(() => { const r = reefs[0], s = r.creatures.get("cleaner"); s.setActive(true, r.world, true); const f = r.world.fish[0] || r.creatures.get("resident"); f.x = s.x + 5; f.y = s.y - 8; f.z = s.z; r.world.fish.splice(0, r.world.fish.length, f); s.calm = 0; s.watch(r.world, s.size(r.world)); return s.dart; })()
```

   Expected：返回 `1`，之后 0.5 秒内清洁虾甩尾往后弹开，尾扇卷到身体下面。换成 `fire` 再执行一次：火焰虾胆小，不弹开，而是回到石头后面躲 8–18 秒（`state` 变成 `"leaving"`，`retreat` 大于 0）。
4. 只看枪虾：`?v=pistol&g=9`，执行 `pause(); for (let i = 0; i < 90; i++) ff(1)`，然后截图。Expected：枪虾离开洞口时，大螯前面推着一小堆沙；停下后沙留在原地，成了一个小沙堆，十几秒后淡掉。偶尔“开枪”：大螯猛地合上，冒出一个闪光的小气泡。

- [ ] **Step 4: Commit**

```bash
git add web/creatures/shrimp.js web/creatures/species.js
git commit -m "feat(aquarium): add cleaner, fire, harlequin, pistol and slipper shrimp"
```

### Task 4: 寄居蟹与螃蟹

**Files:**
- Create: `web/creatures/hermit.js`
- Create: `web/creatures/crab.js`
- Modify: `web/creatures/species.js`

**Interfaces:**
- Consumes: 同 Task 3。
- Produces: `class Hermit extends Crawler`（受惊时缩进壳里 3–6 秒）；`class Crab extends Crawler`（翡翠蟹、瓷蟹、梭子蟹从斜上方的正面画、横着走，箭蟹从侧面画、向前走；受惊时举起大螯；梭子蟹偶尔游一小段，休息时半埋）。两者都有 `static portrait`。

- [ ] **Step 1: 写 `web/creatures/hermit.js`**

```js
import { dot, limb, oval, shade, shadow } from "./paint.js";
import { Crawler, Gait, clamp, follow, knee, noise } from "./motion.js";

// The hermit crab is drawn facing right in units of its length, standing on
// the ground at y = 0. Its borrowed snail shell rides on its back with the
// opening toward the front; legs, claws and eyes come out of the opening and
// pull back inside when it hides.
const C = { shell: "#cdb495", band: "#8c6a4c", lip: "#e8d9c0", inside: "#2a1c16", leg: "#c3302a", joint: "#e6a24a", eye: "#e5c34b" };
const HIPS = [[.22, -.14], [.15, -.12]];
const RESTS = [.42, .27];

// paintHermit draws the crab for a pose: out is how far it has come out of
// its shell (0 inside … 1 out), feet are in unit coordinates.
function paintHermit(c, pose, haze, L) {
  const col = shade(haze), hair = 1 / L, out = pose.out;
  // Far legs behind the shell.
  if (out > .05) for (const [i, [fx, fy]] of pose.far.entries()) {
    const [hx, hy] = HIPS[i], [kx, ky] = knee(hx - .02, hy - .01, fx, fy, .15 * out + .02, .17 * out + .02);
    limb(c, [[hx - .02, hy - .01], [kx, ky], [fx, fy]], Math.max(.04, hair), Math.max(.022, hair * .8), col(C.leg, .9, -.35));
  }
  // The shell: a turban of whorls rising up and back from the opening.
  c.save(); c.rotate(pose.wobble);
  const whorls = [[-.04, -.24, .24], [-.24, -.33, .165], [-.37, -.39, .11], [-.46, -.43, .065]];
  for (const [i, [x, y, r]] of [...whorls.entries()].reverse()) {
    const g = c.createRadialGradient(x + r * .3, y - r * .45, r * .1, x, y, r * 1.05);
    g.addColorStop(0, col(C.lip, 1)); g.addColorStop(.55, col(C.shell, 1)); g.addColorStop(1, col(C.band, 1, -.2));
    c.fillStyle = g; oval(c, x, y, r * 1.05, r * .92, -.5);
    c.strokeStyle = col(C.band, .65); c.lineWidth = hair * 1.2;
    for (let k = 1; k <= 3; k++) { c.beginPath(); c.ellipse(x, y, r * (1.05 - k * .2), r * (.92 - k * .18), -.5, Math.PI * .9, Math.PI * 1.9); c.stroke(); }
    if (i === 0) { c.fillStyle = col(C.band, .5); for (let k = 0; k < 6; k++) oval(c, x - r * .55 + k * r * .2, y + r * .35 - k * r * .12, r * .06, r * .04, -.5); }
  }
  // The opening faces forward and down; the crab comes out of it.
  c.fillStyle = col(C.lip); oval(c, .15, -.15, .085, .1, .45);
  c.fillStyle = col(C.inside); oval(c, .16, -.145, .062, .075, .45);
  c.restore();
  if (out < .03) return;
  c.save(); c.translate(.16, -.15); c.scale(out, out); c.translate(-.16, .15);
  // Antennae and eyes on long yellow stalks.
  c.strokeStyle = col(C.leg, .9); c.lineWidth = Math.max(.008, hair * .8);
  for (const [a, len] of [[pose.whip, .55], [pose.whip - .25, .48]]) { c.beginPath(); c.moveTo(.26, -.24); c.quadraticCurveTo(.26 + Math.cos(a - .4) * len * .5, -.24 + Math.sin(a - .4) * len * .5, .26 + Math.cos(a) * len, -.24 + Math.sin(a) * len * .7); c.stroke(); }
  for (const dx of [0, .02]) {
    c.strokeStyle = col(C.eye, 1, dx ? -.2 : 0); c.lineWidth = Math.max(.024, hair); c.lineCap = "round";
    c.beginPath(); c.moveTo(.2 + dx, -.2); c.lineTo(.27 + dx, -.33); c.stroke();
    c.fillStyle = col("#0c0b0a"); dot(c, .275 + dx, -.345, .026);
    c.fillStyle = `rgba(255,255,255,${.7 * (1 - haze)})`; dot(c, .282 + dx, -.352, .008);
  }
  // Near legs, banded at the joints.
  for (const [i, [fx, fy]] of pose.near.entries()) {
    const [hx, hy] = HIPS[i], [kx, ky] = knee(hx, hy, fx, fy, .15, .17);
    limb(c, [[hx, hy], [kx, ky], [fx, fy]], Math.max(.05, hair * 1.2), Math.max(.026, hair * .9), col(C.leg));
    c.fillStyle = col(C.joint, .9); dot(c, kx, ky, .02);
    c.fillStyle = col("#f2e6d6", .8); dot(c, fx, fy - .01, .012);
  }
  // Two hairy claws held in front; one reaches down while it eats.
  for (const [dx, dy, reach] of [[.02, .02, 0], [0, 0, pose.work]]) {
    const bx = .22 + dx, by = -.16 + dy, tx = .33 + dx - reach * .02, ty = -.11 + dy + reach * .08;
    limb(c, [[bx, by], [tx, ty]], Math.max(.07, hair * 1.5), Math.max(.06, hair * 1.4), col(C.leg, 1, dx ? -.25 : 0));
    const g = c.createLinearGradient(0, ty - .05, 0, ty + .05);
    g.addColorStop(0, col(C.leg, 1, dx ? -.15 : .15)); g.addColorStop(1, col(C.leg, 1, dx ? -.35 : -.1));
    c.fillStyle = g; oval(c, tx + .06, ty + .015, .085, .05, .3);
    c.fillStyle = col("#f2e6d6", .95); oval(c, tx + .135, ty + .045, .026, .016, .3);
    c.fillStyle = col("#f2e6d6", .6); for (let k = 0; k < 4; k++) dot(c, tx + .01 + k * .025, ty - .02 + k * .006, .007);
  }
  c.restore();
}

// Hermit crabs wander the sand with their shells rocking, and pull back
// inside when a fish comes close or when they rest.
export class Hermit extends Crawler {
  constructor(spec, world, options) {
    super(spec, world, options);
    this.legs = new Gait([...RESTS.map((dx, i) => ({ dx, group: i })), ...RESTS.map((dx, i) => ({ dx: dx - .06, group: 1 - i, dz: .05 }))], { stride: .2, lift: .07, duration: .22 });
    this.out = this.state === "in" ? 0 : 1; this.whip = -.6; this.work = 0; this.shy = 0;
  }

  startle(world) { this.shy = 3 + this.rand() * 3; this.goal = null; }

  step(dt, world) {
    if (this.shy > 0) { this.shy -= dt; this.busy = true; } else this.busy = false;
    this.routine(dt, world);
    this.legs.update(dt, this.x, this.legScale(world), this.footing(world), this.vx);
    const inside = this.shy > 0 || this.state === "in";
    this.out = follow(this.out, inside ? 0 : 1, inside ? 9 : 2.5, dt);
    this.whip = follow(this.whip, -.55 + noise(this.seed, this.clock * .7) * .25, 5, dt);
    this.work = this.eating > 0 ? .5 + Math.sin(this.clock * 8) * .5 : follow(this.work, 0, 4, dt);
  }

  draw(c, world) {
    const L = this.size(world), haze = this.z * .5;
    shadow(c, this.x - this.facing * L * .1, this.y + 1, L * .45, L * .1, .32 * (1 - haze));
    const lift = (1 - this.out) * -L * .02 + this.legs.airborne * L * .03;
    c.save(); c.translate(this.x, this.y - lift); c.scale(this.flipX * L, L);
    const feet = this.localFeet(L, lift);
    const wobble = Math.sin(this.clock * 7) * .04 * clamp(Math.abs(this.vx) / (L * .3), 0, 1);
    paintHermit(c, { near: feet.slice(0, 2), far: feet.slice(2), out: this.out, whip: this.whip, work: this.work, wobble }, haze, L);
    c.restore();
  }

  static portrait(c, spec, w, h) {
    const L = Math.min(w * .9 / 1.1, h * .9 / .7);
    c.save(); c.translate(w / 2 + L * .05, h * .88); c.scale(L, L);
    paintHermit(c, { near: RESTS.map(x => [x, 0]), far: RESTS.map(x => [x - .06, -.02]), out: 1, whip: -.55, work: 0, wobble: 0 }, 0, L);
    c.restore();
  }
}
```

- [ ] **Step 2: 写 `web/creatures/crab.js`**

```js
import { curve, dot, limb, oval, shade, shadow, tone, wind } from "./paint.js";
import { Crawler, Gait, TAU, follow, knee, lerp, noise } from "./motion.js";

// Crabs walk sideways, so we see them from the front and a little from
// above. Shells are laid out in plan view in units of carapace width — u
// across the body, w from front (+) to back (−) — and then foreshortened.
// The arrow crab is the exception: its long rostrum only shows from the
// side, so it is drawn side-on and walks forward (see paintArrow).
const SQUASH = .45;

const LOOKS = {
  emerald: {
    plan: [[0, .4], [.12, .41], [.25, .38], [.37, .3], [.45, .16], [.48, 0], [.45, -.16], [.37, -.3], [.23, -.4], [0, -.43]],
    stand: .22, face: .1, hips: [[.42, .2], [.47, .04], [.45, -.12], [.39, -.27]], span: [.74, .84, .82, .7], upper: .3, lower: .36,
    claw: { hip: [.3, .36], palm: [.2, .5], size: .15, kind: "spoon" },
    colors: { shell: "#2f8a52", side: "#1f5f39", leg: "#3d8a57", claw: "#2f7f4c", tip: "#ece6d2", mark: "#5fb27c" },
  },
  porcelain: {
    plan: [[0, .42], [.15, .43], [.3, .38], [.42, .26], [.48, .08], [.47, -.1], [.41, -.26], [.28, -.38], [.12, -.43], [0, -.44]],
    stand: .17, face: .07, hips: [[.43, .12], [.46, -.06], [.41, -.22]], span: [.7, .76, .66], upper: .24, lower: .28,
    claw: { hip: [.36, .3], palm: [.44, .62], size: .2, kind: "flat" },
    colors: { shell: "#f3eee6", side: "#b9ad9e", leg: "#ece4d8", claw: "#efe8dd", tip: "#d9cbb9", mark: "#a5442f" },
  },
  swimmer: {
    plan: [[0, .3], [.1, .31], [.2, .28], [.32, .22], [.44, .13], [.62, .07], [.47, .02], [.38, -.1], [.26, -.22], [.12, -.28], [0, -.3]],
    stand: .2, face: .08, hips: [[.33, .16], [.36, .04], [.33, -.08], [.26, -.2]], span: [.62, .7, .68, .6], upper: .27, lower: .33,
    claw: { hip: [.26, .25], palm: [.5, .5], size: .17, kind: "long" },
    colors: { shell: "#5b5a49", side: "#3b3a2f", leg: "#6e6a62", claw: "#5e6688", tip: "#e9e3d6", mark: "#d9d6c8", paddle: "#7d7a6a" },
  },
};

// at maps a plan point to the screen: the front edge sits lowest.
const at = (look, u, w) => [u, -(look.stand + look.face) - (.42 - w) * SQUASH];

// paintCrab draws a crab facing us for a pose: feet in unit coordinates,
// the claws' work (0…1, alternating sides), raised claws when alarmed, and
// the paddles' stroke for a swimming crab.
function paintCrab(c, id, pose, haze, L) {
  const look = LOOKS[id], C = look.colors, hair = 1 / L, col = shade(haze);
  const outline = [...look.plan, ...look.plan.slice(1, -1).reverse().map(([u, w]) => [-u, w])];
  // Legs come out from under the shell's rim, back pairs first. Each has a
  // thick upper segment, a bend, and a pointed tip on the sand.
  const order = [...look.hips.keys()].reverse(), thick = Math.max(.055, hair * 1.4);
  for (const i of order) for (const side of [-1, 1]) {
    const [hu, hw] = look.hips[i], [hx, hy] = at(look, hu * side, hw), foot = pose.feet[i * 2 + (side > 0 ? 1 : 0)];
    const paddle = id === "swimmer" && i === look.hips.length - 1;
    const ankle = [foot[0] - side * .03, foot[1] - .07];
    const [kx, ky] = knee(hx, hy + look.face * .6, ankle[0], ankle[1], look.upper, look.lower - .06);
    const shade = (hw + .3) * .3 - .2;
    limb(c, [[hx, hy + look.face * .6], [kx, ky], ankle, paddle ? ankle : foot], thick, thick * .45, col(C.leg, 1, shade));
    c.fillStyle = col(C.leg, 1, shade - .15); dot(c, kx, ky, thick * .55);
    if (paddle) {
      c.save(); c.translate(ankle[0], ankle[1]); c.rotate(side * (.5 + Math.sin(pose.stroke) * .7));
      c.fillStyle = col(C.paddle, .95, .05); oval(c, side * .08, .01, .1, .045); c.restore();
    }
  }
  // Shell: its side shows as a darker band below the top.
  const rim = curve(new Path2D(), wind(outline.map(([u, w]) => at(look, u, w)).map(([x, y]) => [x, y + look.face])), true);
  c.fillStyle = col(C.side); c.fill(rim);
  const top = curve(new Path2D(), wind(outline.map(([u, w]) => at(look, u, w))), true);
  const [, y0] = at(look, 0, -.45), [, y1] = at(look, 0, .45);
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, col(C.shell, 1, .14)); g.addColorStop(1, col(C.shell, 1, -.1));
  c.fillStyle = g; c.fill(top);
  c.save(); c.clip(top);
  if (id === "emerald") { c.fillStyle = col(C.mark, .55); for (let i = 0; i < 26; i++) { const u = ((i * 47) % 89) / 89 - .5, w = ((i * 31) % 67) / 67 - .5; dot(c, ...at(look, u * .85, w * .8), .016); } }
  if (id === "porcelain") { c.fillStyle = col(C.mark, .9); for (let i = 0; i < 22; i++) { const u = ((i * 53) % 97) / 97 - .5, w = ((i * 29) % 61) / 61 - .5; oval(c, ...at(look, u * .85, w * .85), .03, .022); } }
  if (id === "swimmer") { c.fillStyle = col(C.mark, .55); for (let i = 0; i < 20; i++) { const u = ((i * 41) % 83) / 83 - .5, w = ((i * 23) % 59) / 59 - .5; oval(c, ...at(look, u, w * .7), .025, .015); } c.strokeStyle = col(C.side, .6); c.lineWidth = hair; c.beginPath(); curve(c, [at(look, -.25, .1), at(look, 0, -.05), at(look, .25, .1)]); c.stroke(); }
  const light = c.createRadialGradient(...at(look, -.1, -.1), .02, ...at(look, 0, 0), .5);
  light.addColorStop(0, `rgba(255,255,255,${.28 * (1 - haze)})`); light.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = light; c.fillRect(-.7, y0 - .1, 1.4, y1 - y0 + .2);
  c.restore();
  // Mouthparts; the porcelain crab sweeps the water with two feathery fans.
  const [, front] = at(look, 0, .42);
  c.fillStyle = col(C.side, 1, -.25); oval(c, 0, front + look.face * .55, .09, look.face * .35);
  if (id === "porcelain") for (const side of [-1, 1]) {
    const sweep = Math.max(0, Math.sin(pose.fan + (side > 0 ? Math.PI : 0)));
    c.save(); c.translate(side * .03, front + look.face * .4); c.rotate(side * (.3 + sweep * .9));
    c.strokeStyle = col("#efe6d8", .75); c.lineWidth = hair * .8;
    for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(side * .05 + k * .015, -.14 - sweep * .04 + Math.abs(k) * .01); c.stroke(); }
    c.restore();
  }
  // Eyes on short stalks at the front edge.
  for (const side of [-1, 1]) {
    const [ex, ey] = at(look, side * .1, .41), tilt = pose.look * .1 * side;
    c.strokeStyle = col(C.shell, 1, -.1); c.lineWidth = hair * 2.6; c.lineCap = "round";
    c.beginPath(); c.moveTo(ex, ey + .01); c.lineTo(ex + side * .025 + tilt, ey - .06); c.stroke();
    c.fillStyle = col("#0d0b0a"); dot(c, ex + side * .028 + tilt, ey - .07, .028);
    c.fillStyle = `rgba(255,255,255,${.7 * (1 - haze)})`; dot(c, ex + side * .028 + tilt + .008, ey - .078, .009);
  }
  // Claws in front: each in turn reaches down and brings food to the mouth;
  // alarmed, both rise.
  for (const side of [-1, 1]) {
    const cl = look.claw, [hx, hy] = at(look, cl.hip[0] * side, cl.hip[1]);
    const work = side < 0 ? Math.max(0, Math.sin(pose.work)) : Math.max(0, -Math.sin(pose.work));
    const raise = pose.alarm, arm = Math.max(.07, hair * 2);
    let px = cl.palm[0] * side, py = front + cl.palm[1] * .4;
    px = lerp(px, side * .06, work * .7); py = lerp(py, front + look.face * .5, work * .6) - work * .02;
    px += side * raise * .12; py -= raise * .3;
    const kx = lerp(hx, px, .5) + side * .1 * (1 - work), ky = lerp(hy, py, .5) + .05 - raise * .1;
    limb(c, [[hx, hy + look.face * .5], [kx, ky], [px, py]], arm, arm * .85, col(C.claw, 1, -.08));
    c.save(); c.translate(px, py); c.rotate(side * (cl.kind === "long" ? 1.1 : .5) - raise * side * .8); c.scale(-side, 1);
    // The claw points inward (+x here): a palm, then a fixed and a moving finger.
    const s = cl.size, long = cl.kind === "long", flat = cl.kind === "flat";
    const pl = s * (long ? 1.6 : flat ? 1 : .8), pw = s * (long ? .32 : flat ? .52 : .45);
    const gc = c.createLinearGradient(0, -pw, 0, pw);
    gc.addColorStop(0, col(C.claw, 1, .2)); gc.addColorStop(1, col(C.claw, 1, -.15));
    c.fillStyle = gc; oval(c, pl * .45, 0, pl * .55, pw);
    if (flat) { c.fillStyle = col(C.mark, .85); for (const [dx, dy] of [[.25, -.3], [.5, .2], [.7, -.15], [.4, .45]]) dot(c, pl * dx, pw * dy, s * .1); }
    if (long) { c.fillStyle = col(C.tip, .8); for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(pl * (.15 + k * .2), -pw * .9); c.lineTo(pl * (.2 + k * .2), -pw * 1.5); c.lineTo(pl * (.25 + k * .2), -pw * .9); c.fill(); } }
    const fx = pl * .95, gap = .25 + work * .2;
    c.fillStyle = col(C.claw, 1, -.18);
    c.beginPath(); c.moveTo(fx, -pw * .5); c.quadraticCurveTo(fx + s * .55, -pw * (.6 + gap), fx + s * .75, -pw * .05); c.quadraticCurveTo(fx + s * .4, -pw * .15, fx, pw * .05); c.fill();
    c.beginPath(); c.moveTo(fx, pw * .55); c.quadraticCurveTo(fx + s * .5, pw * (.6 + gap * .5), fx + s * .7, pw * .1); c.quadraticCurveTo(fx + s * .35, pw * .2, fx, pw * .1); c.fill();
    c.fillStyle = col(C.tip, .95);
    if (cl.kind === "spoon") { oval(c, fx + s * .7, -pw * .08, s * .13, s * .09); oval(c, fx + s * .65, pw * .14, s * .12, s * .08); }
    else { dot(c, fx + s * .72, -pw * .08, s * .05); dot(c, fx + s * .66, pw * .12, s * .045); }
    c.restore();
  }
}

// paintArrow draws the arrow crab side-on, facing right: a small striped
// triangle of a body slung between long, thin legs, a long pointed rostrum
// and slender claws with violet tips. Units are leg span.
function paintArrow(c, pose, haze, L) {
  const col = shade(haze), hair = 1 / L;
  const body = [[.12, -.42], [-.12, -.49], [-.17, -.42], [-.12, -.36], [.06, -.35]];
  const hips = [[.06, -.37], [.02, -.37], [-.03, -.38], [-.08, -.39]];
  const leg = (feet, color, width) => feet.forEach(([fx, fy], i) => {
    const [hx, hy] = hips[i], [kx, ky] = knee(hx, hy, fx, fy, .3, .36);
    limb(c, [[hx, hy], [kx, ky], [fx, fy]], width, width * .55, color);
    c.fillStyle = color; dot(c, kx, ky, width * .7);
  });
  leg(pose.far, col("#c9a46d", .75, -.35), Math.max(.012, hair * .9));
  c.fillStyle = col("#c39a5f"); c.fill(curve(new Path2D(), body, true));
  c.save(); c.clip(curve(new Path2D(), body, true));
  c.strokeStyle = col("#3c2a1b", .8); c.lineWidth = hair * 1.1;
  for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(.12, -.425 + k * .012); c.lineTo(-.18, -.5 + k * .03); c.stroke(); }
  c.strokeStyle = col("#f0d9a0", .7);
  for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(.12, -.418 + k * .012); c.lineTo(-.18, -.49 + k * .03); c.stroke(); }
  c.restore();
  // The rostrum points forward and a little up, like an arrow.
  c.fillStyle = col("#b98c52"); c.beginPath(); c.moveTo(.1, -.44); c.lineTo(.5, -.53); c.lineTo(.1, -.415); c.fill();
  c.strokeStyle = col("#3c2a1b", .6); c.lineWidth = hair * .8; c.beginPath(); c.moveTo(.12, -.43); c.lineTo(.48, -.525); c.stroke();
  c.fillStyle = col("#120e0b"); dot(c, .09, -.455, .016);
  // Slender claws reach forward and down; they pick at the bottom while eating.
  const reach = pose.work;
  for (const [dy, light] of [[0, -.3], [.01, 0]]) {
    const tip = [.36 - reach * .06, -.18 + dy + reach * .14];
    limb(c, [[.08, -.37 + dy], [.22, -.33 + dy], tip], Math.max(.018, hair), Math.max(.014, hair * .9), col("#c9a46d", 1, light));
    c.fillStyle = col("#7d5fb8", .95, light); oval(c, tip[0] + .03, tip[1] + .01, .035, .012, .5);
  }
  leg(pose.near, col("#d8b47c", .95), Math.max(.016, hair * 1.1));
}

// Crabs sidestep on alternating legs, pick at the bottom with their claws,
// raise them when a fish comes close, and (the swimming crab) paddle off
// the sand for a short swim or dig in to rest.
export class Crab extends Crawler {
  constructor(spec, world, options) {
    super(spec, world, options);
    this.arrow = spec.id === "arrow";
    if (this.arrow) {
      const rests = [.42, .22, -.08, -.32];
      this.legs = new Gait([...rests.map((dx, i) => ({ dx, group: i % 2 })), ...rests.map((dx, i) => ({ dx: dx + .05, group: 1 - i % 2, dz: .05 }))], { stride: .2, lift: .1, duration: .3 });
    } else {
      const look = LOOKS[spec.id], legs = [];
      look.hips.forEach(([, w], i) => { for (const side of [-1, 1]) legs.push({ dx: side * look.span[i], group: (i + (side > 0 ? 1 : 0)) % 2, dz: (.2 - w) * .08 }); });
      this.legs = new Gait(legs, { stride: .2, lift: .1, duration: .2 });
    }
    this.work = 0; this.alarm = 0; this.fan = 0; this.stroke = 0; this.swim = 0; this.rise = 0; this.buried = 0; this.look = 0;
  }

  get resting() { return this.state === "in" && !this.hides; }

  startle(world) { this.alarm = 1; this.goal = null; this.until = world.time + 3; }

  wander(world) {
    // Now and then the swimming crab paddles off instead of walking.
    if (this.spec.id === "swimmer" && this.rand() < .35) this.swim = 1.6 + this.rand();
    return super.wander(world);
  }

  step(dt, world) {
    const L = this.size(world);
    if (this.swim > 0) this.swim -= dt;
    const swimming = this.swim > 0 && this.state === "out";
    this.routine(dt * (swimming ? 2.2 : 1), world);
    this.rise = follow(this.rise, swimming ? L * .7 : 0, 3, dt);
    if (this.rise > L * .05) this.legs.place(this.x, this.legScale(world), (x, leg) => this.footing(world)(x, leg) - this.rise);
    else this.legs.update(dt, this.x, this.legScale(world), this.footing(world), this.vx);
    this.alarm = follow(this.alarm, 0, .7, dt);
    this.work = this.eating > 0 || (this.state === "out" && !this.goal && this.spec.id !== "porcelain") ? this.work + dt * (this.eating > 0 ? 7 : 2.5) : this.work;
    this.fan += dt * 6;
    this.stroke += dt * (swimming ? 14 : 0);
    this.look = noise(this.seed + 2, this.clock * .5);
    this.buried = follow(this.buried, this.resting && this.spec.id === "swimmer" ? 1 : 0, 1, dt);
  }

  draw(c, world) {
    if (this.hidden) return;
    const L = this.size(world), haze = this.z * .5;
    c.save(); c.globalAlpha = this.shown;
    shadow(c, this.x, this.y + 1, L * (this.arrow ? .35 : .55), L * .1, (this.arrow ? .2 : .32) * (1 - haze) / (1 + this.rise / L * 2));
    const lift = this.rise + this.legs.airborne * L * .02, sink = this.buried * L * .18;
    c.translate(this.x, this.y - lift + sink);
    if (sink > 0) { c.beginPath(); c.rect(-L * 2, -L * 2, L * 4, L * 2 - sink + 1); c.clip(); }
    if (this.arrow) {
      c.scale(this.flipX * L, L);
      const feet = this.localFeet(L, lift);
      paintArrow(c, { near: feet.slice(0, 4), far: feet.slice(4), work: this.eating > 0 ? .5 + Math.sin(this.clock * 8) * .5 : 0 }, haze, L);
    } else {
      c.scale(L, L);
      const feet = this.localFeet(L, lift - sink);
      paintCrab(c, this.spec.id, { feet, work: this.work, alarm: this.alarm, fan: this.fan, stroke: this.stroke, look: this.look }, haze, L);
    }
    c.restore();
    if (this.buried > .01) { c.fillStyle = tone("#718371", haze, this.buried); c.beginPath(); c.ellipse(this.x, this.y + 1, L * .7, L * .1, 0, 0, TAU); c.fill(); }
  }

  static portrait(c, spec, w, h) {
    if (spec.id === "arrow") {
      const L = Math.min(w * .9 / 1.15, h * .9 / .6);
      c.save(); c.translate(w / 2 - L * .08, h * .92); c.scale(L, L);
      const near = [.42, .22, -.08, -.32].map(x => [x, 0]);
      paintArrow(c, { near, far: near.map(([x]) => [x + .05, -.02]), work: 0 }, 0, L);
      c.restore(); return;
    }
    const look = LOOKS[spec.id], L = Math.min(w * .9 / 1.9, h * .88 / .85);
    c.save(); c.translate(w / 2, h * .88); c.scale(L, L);
    const feet = [];
    look.hips.forEach(([, wv], i) => { for (const side of [-1, 1]) feet.push([side * look.span[i], -(.2 - wv) * .08]); });
    paintCrab(c, spec.id, { feet, work: 0, alarm: 0, fan: 1, stroke: 0, look: 0 }, 0, L);
    c.restore();
  }
}
```

- [ ] **Step 3: 在 `web/creatures/species.js` 注册模型**

在 `import { Fish } from "./fish.js";` 之后的导入里追加：

```js
import { Hermit } from "./hermit.js";
import { Crab } from "./crab.js";
```

并把

```js
const MODELS = { fish: Fish, shrimp: Shrimp };
```

改成

```js
const MODELS = { fish: Fish, shrimp: Shrimp, hermit: Hermit, crab: Crab };
```

- [ ] **Step 4: 验收**

1. `?gallery=hermit,emerald,porcelain,swimmer,arrow&w=420&h=250`：寄居蟹背着带螺纹的米褐色螺壳，红腿、红螯、黄色眼柄；翡翠蟹绿色、腿粗、螯尖呈勺状；瓷蟹白底红点、两只大而扁的螯；梭子蟹甲壳宽梭形、两侧有长刺、蓝紫色长螯带刺、最后一对足是桨；箭蟹是带条纹的三角形身体加长额角，腿细长。
2. `?v=hermit,emerald,porcelain,swimmer,arrow&g=9`，执行 `pause(); for (let i = 0; i < 4; i++) ff(30)`，每次快进后截一张图：腿左右交替迈步、脚不打滑；螃蟹横着走；走上石头时整只抬高；躲到石头后面时逐渐淡出。`errors` 为 `[]`。

- [ ] **Step 5: Commit**

```bash
git add web/creatures/hermit.js web/creatures/crab.js web/creatures/species.js
git commit -m "feat(aquarium): add hermit, emerald, porcelain, arrow and swimming crabs"
```

### Task 5: 皮皮虾，以及全员验收

**Files:**
- Create: `web/creatures/mantis.js`
- Modify: `web/creatures/species.js`

**Interfaces:**
- Consumes: 同 Task 3；场景的 `world.burrows.mantis`。
- Produces: `class Mantis extends Crawler`。在洞里时只在洞口探出头和眼睛，两只眼睛各转各的；出来时在洞附近巡游，吃东西时锤状捕肢往前弹；受惊时回洞 10–20 秒。有 `static portrait`。

- [ ] **Step 1: 写 `web/creatures/mantis.js`**

```js
import { curve, dot, hole, limb, lip, oval, shade, shadow } from "./paint.js";
import { Crawler, Gait, clamp, follow, knee, noise } from "./motion.js";

// The peacock mantis shrimp is drawn facing right in units of body length,
// low on the ground at y = 0: a long flattened body, two big eyes on stalks
// that turn on their own, clubs folded under the head and a bright tail fan.
const C = { body: "#3d8a4c", dark: "#24552f", head: "#76b06c", spot: "#24502c", leg: "#e8792f", club: "#d8473b", scale: "#e46a35", edge: "#b0302a", tail: "#4565c8", rim: "#e98a3c", eye: "#43b4a4" };
const HIPS = [[.14, -.05], [.1, -.05], [.06, -.05]];
const RESTS = [.2, .12, .04];

// paintMantis draws the mantis shrimp for a pose: feet in unit coordinates,
// the eyes' angles, and strike (0…1) when its club snaps out for food.
function paintMantis(c, pose, haze, L) {
  const col = shade(haze), hair = 1 / L, thin = Math.max(.014, hair * .9);
  for (const [fx, fy] of pose.far) limb(c, [[.1, -.05], knee(.1, -.05, fx, fy, .045, .05), [fx, fy]], thin, thin * .7, col(C.leg, .7, -.35));
  // Tail fan: blue blades edged in orange.
  for (const [a, len] of [[-.45, .12], [.45, .12], [-.2, .13], [.2, .13]]) {
    c.save(); c.translate(-.4, -.07); c.rotate(Math.PI + a * .6);
    c.fillStyle = col(C.rim); oval(c, len * .5, 0, len * .55, .032);
    c.fillStyle = col(C.tail); oval(c, len * .48, 0, len * .46, .022);
    c.restore();
  }
  c.fillStyle = col(C.body, 1, .1); oval(c, -.43, -.07, .05, .035);
  // Body: one long, flattened body crossed by segment lines, red spots along
  // its sides, then the spotted head shield.
  const body = curve(new Path2D(), [[.22, -.125], [.05, -.13], [-.15, -.14], [-.33, -.13], [-.42, -.105], [-.44, -.06], [-.36, -.03], [-.15, -.02], [.05, -.022], [.22, -.03]], true);
  const g = c.createLinearGradient(0, -.14, 0, -.02);
  g.addColorStop(0, col(C.body, 1, .15)); g.addColorStop(.6, col(C.body)); g.addColorStop(1, col(C.dark));
  c.fillStyle = g; c.fill(body);
  c.save(); c.clip(body);
  c.strokeStyle = col(C.dark, .85); c.lineWidth = Math.max(.008, hair);
  for (let i = 0; i < 8; i++) { const x = -.36 + i * .075; c.beginPath(); c.moveTo(x + .012, -.15); c.quadraticCurveTo(x - .012, -.08, x + .01, -.01); c.stroke(); }
  c.fillStyle = col(C.edge, .75); for (let i = 0; i < 7; i++) dot(c, -.33 + i * .075, -.035, .009);
  c.fillStyle = `rgba(255,255,255,${.18 * (1 - haze)})`; c.fillRect(-.45, -.15, .7, .03);
  c.restore();
  const head = [[.47, -.1], [.42, -.15], [.3, -.16], [.2, -.14], [.18, -.06], [.3, -.04], [.42, -.05]];
  const hp = curve(new Path2D(), head, true);
  c.fillStyle = col(C.head); c.fill(hp);
  c.save(); c.clip(hp); c.fillStyle = col(C.spot, .8);
  for (const [x, y, r] of [[.24, -.12, .012], [.29, -.09, .01], [.34, -.13, .011], [.38, -.08, .009], [.27, -.06, .008], [.41, -.12, .008], [.21, -.09, .009]]) dot(c, x, y, r);
  c.restore();
  // Antennal scales flare at the sides of the head.
  for (const tilt of [-.5, -.2]) { c.save(); c.translate(.42, -.09); c.rotate(tilt); c.fillStyle = col(C.edge); oval(c, .05, 0, .055, .022); c.fillStyle = col(C.scale); oval(c, .048, -.002, .045, .015); c.restore(); }
  // The club folds under the head; it snaps forward to strike.
  const strike = pose.strike, reach = .06 + strike * .14;
  limb(c, [[.36, -.06], [.42 + strike * .05, -.02], [.36 + reach, -.035 + strike * .02]], Math.max(.03, hair * 1.2), Math.max(.026, hair), col(C.club, 1, -.1));
  c.fillStyle = col(C.club, 1, .08); oval(c, .37 + reach, -.035 + strike * .02, .03, .022, -.3 + strike);
  c.fillStyle = col("#f1d9cf", .8); dot(c, .38 + reach, -.04 + strike * .02, .007);
  for (const [fx, fy] of pose.near) limb(c, [[.12, -.045], knee(.12, -.045, fx, fy, .045, .05), [fx, fy]], thin * 1.2, thin * .8, col(C.leg));
  // Antennules: three thin whips.
  c.strokeStyle = col(C.leg, .8); c.lineWidth = thin * .7;
  for (const a of [-.55, -.35, -.15]) { c.beginPath(); c.moveTo(.46, -.13); c.quadraticCurveTo(.56, -.18 + a * .1, .7 + a * .1, -.24 + a * .25 + pose.sway * .02); c.stroke(); }
  // Eyes on stalks, each turning on its own; a band divides every eye.
  pose.eyes.forEach((turn, i) => {
    const bx = .44 - i * .03, by = -.15;
    c.strokeStyle = col(C.head, 1, -.1); c.lineWidth = Math.max(.018, hair); c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + .02, by - .05); c.stroke();
    c.save(); c.translate(bx + .022, by - .07); c.rotate(turn);
    c.fillStyle = col(C.eye, 1, i ? -.25 : 0); oval(c, 0, 0, .03, .045);
    c.fillStyle = col("#1e3b3a", .85); c.fillRect(-.03, -.006, .06, .012);
    c.fillStyle = `rgba(255,255,255,${.6 * (1 - haze)})`; dot(c, -.006, -.018, .006);
    c.restore();
  });
}

// The mantis shrimp lives in a burrow: resting, it watches from the opening
// with only its eyes showing; out, it patrols nearby and strikes at food.
export class Mantis extends Crawler {
  constructor(spec, world, options) {
    super(spec, world, options);
    this.legs = new Gait([...RESTS.map((dx, i) => ({ dx, group: i % 2 })), ...RESTS.map((dx, i) => ({ dx: dx - .03, group: 1 - i % 2, dz: .04 }))], { stride: .12, lift: .03, duration: .16 });
    this.eyes = [0, 0]; this.strike = 0; this.peek = 1; this.sway = 0;
  }

  settle(world) {
    const b = world.burrows.mantis;
    this.burrow = b; this.home = this.den = { x: b.x, z: b.z }; this.depths = [Math.max(0, b.z - .08), b.z + .08]; this.hides = true;
  }

  startle() { this.hideAway(10 + this.rand() * 10); }

  step(dt, world) {
    this.routine(dt, world);
    this.legs.update(dt, this.x, this.legScale(world), this.footing(world), this.vx);
    const t = this.clock;
    this.eyes = [noise(this.seed, t * .7) * 1.2, noise(this.seed + 1, t * .6 + 3) * 1.2];
    this.strike = this.eating > 0 ? Math.max(0, Math.sin(t * 5)) ** 6 : follow(this.strike, 0, 10, dt);
    this.peek = follow(this.peek, noise(this.seed + 5, t * .08) > -.35 ? 1 : 0, 1.5, dt);
    this.sway = Math.sin(t * 2);
    this.shown = 1;
  }

  under(c, world) { const b = this.burrow; hole(c, b.x, world.ground(b.x, b.z), this.spec.length * world.px * .2); }

  draw(c, world) {
    const L = this.size(world), haze = this.z * .5, b = this.burrow, by = world.ground(b.x, b.z), r = this.spec.length * world.px * .2;
    const pose = { near: [], far: [], eyes: this.eyes, strike: this.strike, sway: this.sway };
    if (this.state === "in") {
      // Watching from the burrow: head up, the rest hidden below the rim.
      if (this.peek < .05) { lip(c, b.x, by, r); return; }
      c.save(); c.beginPath(); c.rect(b.x - L, by - L, L * 2, L - r * .15); c.clip();
      c.translate(b.x - this.facing * L * .1, by + L * (.46 - this.peek * .12)); c.scale(this.facing * L, L); c.rotate(-1.3);
      paintMantis(c, pose, haze, L);
      c.restore();
      lip(c, b.x, by, r);
      return;
    }
    const near = 1 - clamp(Math.abs(this.x - b.x) / (L * .5), 0, 1), sink = this.state === "leaving" ? near : 0;
    shadow(c, this.x, this.y + 1, L * .5, L * .07, .3 * (1 - haze) * (1 - sink));
    c.save();
    if (sink > 0) { c.beginPath(); c.rect(this.x - L, this.y - L, L * 2, L - sink * L * .1); c.clip(); }
    c.translate(this.x, this.y + sink * L * .12); c.scale(this.flipX * L, L);
    const feet = this.localFeet(L);
    pose.near = feet.slice(0, 3); pose.far = feet.slice(3);
    paintMantis(c, pose, haze, L);
    c.restore();
    lip(c, b.x, by, r);
  }

  static portrait(c, spec, w, h) {
    const L = Math.min(w * .9 / 1.15, h * .85 / .38);
    c.save(); c.translate(w / 2 - L * .1, h * .75); c.scale(L, L);
    paintMantis(c, { near: RESTS.map(x => [x, 0]), far: RESTS.map(x => [x - .03, -.01]), eyes: [.3, -.4], strike: 0, sway: 0 }, 0, L);
    c.restore();
  }
}
```

- [ ] **Step 2: 在 `web/creatures/species.js` 注册模型**

在 `import { Fish } from "./fish.js";` 之后的导入里追加：

```js
import { Mantis } from "./mantis.js";
```

并把

```js
const MODELS = { fish: Fish, shrimp: Shrimp, hermit: Hermit, crab: Crab };
```

改成

```js
const MODELS = { fish: Fish, shrimp: Shrimp, mantis: Mantis, hermit: Hermit, crab: Crab };
```

- [ ] **Step 3: 验收**

1. `?gallery`（不带参数，16 种全画）：皮皮虾是绿色扁长的身体，头部带斑点，有一对条带大眼、红色锤状捕肢和蓝橙色尾扇；其余 15 种和前面的任务一致。
2. 用全部访客打开：`?v=clown,tang,angel,puffer,cleaner,fire,harlequin,pistol,mantis,slipper,hermit,emerald,porcelain,arrow,swimmer&g=24`。`errors` 为 `[]`；主窗口在外的虾蟹 5 只，挂件 3 只；皮皮虾在洞口探头。
3. 性能，在主窗口尺寸（`&sizes=611x291`）下执行：

```js
(() => { pause(); const r = reefs[0], draw = []; for (let i = 0; i < 480; i++) { r.time += 1 / 24; r.step(1 / 24); const a = performance.now(); r.draw(); draw.push(performance.now() - a); } draw.sort((x, y) => x - y); return { avg: draw.reduce((x, y) => x + y) / draw.length, p95: draw[456] }; })()
```

   Expected：`avg` 不超过 4（实测约 0.58），`p95` 实测约 1.1。
4. 轮换与喂食：

```js
(() => { const r = reefs[0], log = []; for (let k = 1; k <= 6; k++) { ff(30); log.push(k * 30 + "s " + [...r.creatures.values()].filter(c => c.crawler && c.active).map(c => c.spec.id + "/" + c.state).join(" ")); } feed(); let sand = 0; const eat = r.world.eat; r.world.eat = p => { if (p.landed) sand++; eat(p); }; for (let i = 0; i < 30; i++) ff(1); return { log, sand }; })()
```

   Expected：每个时间点都正好 5 只 `active`，名单在几分钟内有变化；`sand` 至少为 1，也就是有虾蟹吃到了落到沙地的鱼食。

- [ ] **Step 4: Commit**

```bash
git add web/creatures/mantis.js web/creatures/species.js
git commit -m "feat(aquarium): add the peacock mantis shrimp in its burrow"
```

### Task 6: 画风检查点（请用户确认）

**Files:** 无改动。

- [ ] **Step 1: 准备给用户看的画面**

起浏览器模式打开 `all` 存档，拿到主窗口（1100×800）的整页截图、挂件模式的截图，以及验收页 `?gallery&w=420&h=250` 的物种总览截图。

- [ ] **Step 2: 请用户确认**

把截图和浏览器模式的地址发给用户，请用户重点看三件事：鱼还“假”不假、每种虾蟹是否认得出、画面是否拥挤。用户确认之前，不往下做。

- [ ] **Step 3: 按反馈调整**

用户要求改的地方，在对应模型文件里改，重做 Task 2–5 里相关的验收步骤，每类改动单独提交一次，提交信息写清楚改了什么。

### Task 7: 图鉴小画像

**Files:**
- Modify: `web/app.js:1-2`（导入）、`web/app.js:143-153`（`renderVisitors`）
- Modify: `web/style.css`（`.visitor>span` 一条规则）

**Interfaces:**
- Consumes: `drawPortrait(canvas, id)`（Task 2）。
- Produces: 图鉴卡片的第一个子元素变成 `<canvas class="portrait">`。

- [ ] **Step 1: 导入画像函数**

在 `web/app.js` 第 2 行 `import { Reef } from "./reef.js";` 之后加一行：

```js
import { drawPortrait } from "./creatures/species.js";
```

- [ ] **Step 2: 改写 `renderVisitors`**

把 `web/app.js` 里整个 `renderVisitors` 函数替换为：

```js
function renderVisitors() {
  if (!state.visitors.length) return;
  const portraits = [];
  $("visitors").replaceChildren(...state.visitors.map(v => {
    const el = document.createElement("div"); el.className = "visitor";
    const portrait = document.createElement("canvas"); portrait.className = "portrait"; portrait.setAttribute("aria-hidden", "true");
    const info = document.createElement("div"), title = document.createElement("p"), date = document.createElement("small");
    title.textContent = v.name; date.textContent = `${new Date(v.date).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} · 来过 ${v.visits} 次`;
    info.append(title, date); el.append(portrait, info); portraits.push([portrait, v.species]); return el;
  }));
  // Portraits size themselves from their box, so paint them once they are on the page.
  for (const [portrait, species] of portraits) drawPortrait(portrait, species);
}
```

- [ ] **Step 3: 画像的尺寸**

在 `web/style.css` 里把 `.visitor>span{font-size:25px}` 替换为：

```css
.visitor>.portrait{width:46px;height:32px;flex:none}
```

- [ ] **Step 4: 验收**

浏览器模式打开 `all` 存档：图鉴有 15 张小画像，鱼和虾是侧面、螃蟹是正面，和水缸里的样子一致，控制台没有报错。再用开发者工具把 `all/aquarium.json` 里某个访客的 `species` 改成 `"volcano"`，重启后打开：那张卡片显示通用剪影，水缸里不画它，也不报错。改完记得恢复那份存档。

- [ ] **Step 5: Commit**

```bash
git add web/app.js web/style.css
git commit -m "feat(aquarium): paint visitor portraits with the creature models"
```

### Task 8: Go 端：访客名单与遇见规则

**Files:**
- Create: `species_test.go`
- Modify: `state.go:72-84`（`Aquarium` 增加 `roll`）、`state.go:85-86`（`newAquarium`）、`state.go:349-354`（`species`）、`state.go:367-369`（`completeLocked`）

**Interfaces:**
- Consumes: `web/creatures/species.js` 里每个物种都写成 `id: "<id>"`（Task 2）。
- Produces: `species []Visitor`（15 项，小丑鱼排第一）；`Aquarium.roll func(n int) int`（默认 `rand.IntN`）；`(*Aquarium).nextVisitorLocked() Visitor`。

- [ ] **Step 1: 写失败的测试**

新建 `species_test.go`：

```go
package main

import (
	"io/fs"
	"math/rand/v2"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// completeRound runs one focus round to completion.
func completeRound(t *testing.T, a *Aquarium, now *time.Time) Snapshot {
	t.Helper()
	if _, err := a.Start("focus", ""); err != nil {
		t.Fatal(err)
	}
	advance(a, now, 61)
	return a.Get()
}

func TestSpeciesRosterIsComplete(t *testing.T) {
	if len(species) != 15 || species[0].Species != "clown" {
		t.Fatalf("roster: %+v", species)
	}
	seen := map[string]bool{}
	for _, s := range species {
		if s.Species == "" || s.Name == "" || seen[s.Species] {
			t.Errorf("bad or duplicate species: %+v", s)
		}
		seen[s.Species] = true
	}
}

// The page must know how to draw every species the backend can send.
func TestFrontendKnowsEverySpecies(t *testing.T) {
	data, err := fs.ReadFile(frontend, "web/creatures/species.js")
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range species {
		if !strings.Contains(string(data), `id: "`+s.Species+`"`) {
			t.Errorf("species.js has no %q", s.Species)
		}
	}
}

func TestVisitorsArriveUnmetFirst(t *testing.T) {
	a, now := testAquarium(t)
	pick := rand.New(rand.NewPCG(1, 2))
	// Every round brings a visitor; who comes is still left to chance.
	a.roll = func(n int) int {
		if n == 3 {
			return 0
		}
		return pick.IntN(n)
	}
	for round := 1; round <= len(species); round++ {
		s := completeRound(t, a, now)
		if len(s.Visitors) != round {
			t.Fatalf("round %d: %d visitors, want a new species every round: %+v", round, len(s.Visitors), s.Visitors)
		}
		if round == 1 && s.Visitors[0].Species != "clown" {
			t.Fatalf("first visitor %q, want clown", s.Visitors[0].Species)
		}
	}
	s := completeRound(t, a, now)
	visits := 0
	for _, v := range s.Visitors {
		visits += v.Visits
	}
	if len(s.Visitors) != len(species) || visits != len(species)+1 {
		t.Fatalf("after everyone has visited: %d species, %d visits", len(s.Visitors), visits)
	}
}

func TestOldSaveMeetsNewSpecies(t *testing.T) {
	path := filepath.Join(t.TempDir(), "aquarium.json")
	old := `{"preferences":{"focusMinutes":1,"breakMinutes":1,"sound":"waves","volume":0.35,"chimeEnabled":true},
"session":{"id":1,"kind":"focus","status":"idle","durationMs":60000},"completed":4,
"visitors":[{"species":"clown","name":"小丑鱼","date":"2026-10-10T10:00:00+08:00","visits":2},
{"species":"tang","name":"蓝吊鱼","date":"2026-10-11T10:00:00+08:00","visits":1},
{"species":"angel","name":"神仙鱼","date":"2026-10-12T10:00:00+08:00","visits":1},
{"species":"puffer","name":"小河豚","date":"2026-10-13T10:00:00+08:00","visits":1}]}`
	if err := os.WriteFile(path, []byte(old), 0o600); err != nil {
		t.Fatal(err)
	}
	a, err := newAquarium(path)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 15, 10, 0, 0, 0, time.Local)
	a.now = func() time.Time { return now }
	a.roll = func(int) int { return 0 }
	s := completeRound(t, a, &now)
	if len(s.Visitors) != 5 || s.Visitors[4].Species != "cleaner" || s.Visitors[0].Visits != 2 {
		t.Fatalf("old save after a round: %+v", s.Visitors)
	}
}
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=4GiB GOFLAGS=-p=2 go test -p 2 -parallel 2 ./...`
Expected：编译失败，`a.roll undefined (type *Aquarium has no field or method roll)`。

- [ ] **Step 3: 给 `Aquarium` 加上可替换的随机函数**

在 `state.go` 的 `Aquarium` 结构体里，`now      func() time.Time` 之后加一行：

```go
	roll     func(n int) int // random number in [0, n); tests replace it
```

把 `newAquarium` 的第一行改为：

```go
	a := &Aquarium{path: path, now: time.Now, roll: rand.IntN, stop: make(chan struct{}), done: make(chan struct{})}
```

- [ ] **Step 4: 扩充名单，先遇见没见过的**

把 `state.go` 里的 `var species = …` 整段替换为：

```go
// species lists every visitor, fish first, then shrimp and crabs. The ids
// are saved in the visitor book and drawn by web/creatures/species.js.
var species = []Visitor{
	{Species: "clown", Name: "小丑鱼"},
	{Species: "tang", Name: "蓝吊鱼"},
	{Species: "angel", Name: "神仙鱼"},
	{Species: "puffer", Name: "小河豚"},
	{Species: "cleaner", Name: "清洁虾"},
	{Species: "fire", Name: "火焰虾"},
	{Species: "harlequin", Name: "油彩蜡膜虾"},
	{Species: "pistol", Name: "枪虾"},
	{Species: "mantis", Name: "皮皮虾"},
	{Species: "slipper", Name: "琵琶虾"},
	{Species: "hermit", Name: "寄居蟹"},
	{Species: "emerald", Name: "翡翠蟹"},
	{Species: "porcelain", Name: "瓷蟹"},
	{Species: "arrow", Name: "箭蟹"},
	{Species: "swimmer", Name: "梭子蟹"},
}

// nextVisitorLocked picks who comes: the clownfish after the first round,
// then someone not met yet, and once everyone has come, any old friend.
func (a *Aquarium) nextVisitorLocked() Visitor {
	if a.state.Completed == 1 {
		return species[0]
	}
	var unmet []Visitor
	for _, s := range species {
		if !slices.ContainsFunc(a.state.Visitors, func(v Visitor) bool { return v.Species == s.Species }) {
			unmet = append(unmet, s)
		}
	}
	if len(unmet) == 0 {
		unmet = species
	}
	return unmet[a.roll(len(unmet))]
}
```

再把 `completeLocked` 里的

```go
	if a.state.Completed == 1 || rand.IntN(3) == 0 {
		v := species[(a.state.Completed-1)%len(species)]
```

改为

```go
	if a.state.Completed == 1 || a.roll(3) == 0 {
		v := a.nextVisitorLocked()
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=4GiB GOFLAGS=-p=2 go test -p 2 -parallel 2 ./... && go vet ./... && gofmt -l state.go species_test.go`
Expected：`ok  	little-reef`；`go vet` 没有输出；`gofmt -l` 也没有输出。（`main.go` 原本就有一处没按 gofmt 排版，不在这次范围内。）

- [ ] **Step 6: Commit**

```bash
git add state.go species_test.go
git commit -m "feat(aquarium): meet shrimp and crabs, newcomers first"
```

### Task 9: README 与整体验证

**Files:**
- Modify: `README.md`（开头一段、“功能”、“测试覆盖”）

- [ ] **Step 1: 更新 README**

把开头一段里的

```text
偶尔还会有鱼来做客。
```

改为

```text
偶尔还会有鱼、虾或螃蟹来做客。
```

把“功能”里的两条

```markdown
- 第一轮必定遇见小丑鱼，之后每完成一轮，有三分之一的机会遇见新访客。图鉴会一直保存。
- 每次休息可以喂一次鱼。不用一直照料，中断或离开也不会死鱼，也不会扣掉装饰。
```

替换为

```markdown
- 第一轮必定遇见小丑鱼，之后每完成一轮，有三分之一的机会遇见访客：4 种鱼、6 种虾和 5 种蟹。没见过的朋友先来，15 位都见过之后，老朋友会再来做客。图鉴会一直保存。
- 每种生物都照真实物种来画。鱼会摆尾、悬停、转身，彼此保持距离；虾蟹在沙地和石头上爬，会躲进石缝、洞里或螺壳里，同一时间只有几只在外面活动。
- 每次休息可以喂一次鱼。鱼食慢慢下沉，鱼吃剩的落到沙地上，由虾蟹捡走。不用一直照料，中断或离开也不会死鱼，也不会扣掉装饰。
```

在“测试覆盖”的“存档”一条之后加一条：

```markdown
- **访客：** 第一轮遇见小丑鱼，先遇见没见过的物种，旧存档也能遇见新物种，页面认得每一个物种。
```

- [ ] **Step 2: 全量测试**

Run: `CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=4GiB GOFLAGS=-p=2 go test -p 2 -parallel 2 ./... && go vet ./... && for f in web/*.js web/creatures/*.js; do node --check "$f"; done`
Expected：全部通过，没有输出错误。

- [ ] **Step 3: 浏览器模式整体验证**

分别打开 `none`、`four`、`all` 三份存档：
1. 主窗口和挂件两种尺寸都正常；`none` 只有海金鱼和两组石头；`all` 有 15 张图鉴画像。
2. 开始一轮休息并撒鱼食：鱼食下沉，鱼吃几粒，剩下的落到沙地被虾蟹捡走，约 20 秒后结束。
3. 在开发者工具里模拟 `prefers-reduced-motion: reduce`（Rendering 面板）：画面静止，重画位置不变，撒鱼食时没有动画。
4. 控制台没有报错。

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(aquarium): describe the shrimp, crabs and lifelike reef"
```

- [ ] **Step 5: 交给用户在桌面版确认**

请用户用 `CGO_ENABLED=0 go run .` 打开桌面版，用自己的存档看一段时间：每种生物都认得出、动作自然、画面不拥挤。版本号和 CHANGELOG 等发布时再处理。
