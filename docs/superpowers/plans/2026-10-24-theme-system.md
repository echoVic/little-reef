# 主题系统（多主题包）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「纯写实深海底」的硬编码视觉，改造成可切换的主题包系统：现有写实主题作为 `reef-realistic` 纳入同一 token 契约，九套新主题（cn-shuimo / cn-qinghua / cn-qinglu / cm-pop / cm-cel / cm-ink / ct-cream / ct-strawberry / ct-jelly）逐套落地，切换入口为菜单栏下拉子菜单（用户拍板）。全程守住硬红线：**主题是纯表现层，切换绝不触碰存档**。

成功定义：
1. 切换主题 = 重绑 CSS 变量 + 替换生物绘制引用，不产生任何 aquarium.json 读写；有测试锁定「切换 100 次后 aquarium.json 字节级不变」。
2. 主题选择持久化（重启后保留），但**不写入 aquarium.json**，满足上条回归口径。
3. 菜单栏「主题 ▸」子菜单单选列表（勾选态），切换即时生效、无弹窗、无庆祝动效。
4. 现有写实视觉零回归（reef-realistic 抽取后逐像素不变，由现有截图/测试兜底）。
5. 各主题动效密度按设计文档分级，系统「减少动态效果」开启时全部静止停靠。

**Architecture:**

- **theme 包形态**：`web/themes/<themeId>/theme.json`（meta + tokens + assets 清单），随 `//go:embed web` 一起内嵌 [现状：web/ 整目录 embed]。theme.json 结构严格按设计文档第 04 章 a 节：meta（themeId/displayName/styleFamily/version/minAppVersion/supportsDarkAppearance/reduceMotionFallback）+ tokens（背景 4 + 生物 4 + UI 8 + 动效守门 4）+ assets 清单。未提供的 token 回退继承 reef-realistic 的值（设计文档 04a：「新主题可以只写差异项」）。Go 侧用 struct 定义 schema（设计文档 04c：「theme.json schema 用 Go 侧 struct 定义并生成 TypeScript 类型」）。
- **token → CSS 变量映射**：theme.js 读当前主题 token 表，写到 `:root` 的一组变量（现有 style.css:1 已有 `:root{--bg...}` 10 个变量 [C1]），新增 `--timer-active/--timer-pause/--control-bg/--control-border/--text-secondary/--water-light/--sand/--bubble` 等，把 style.css 里硬编码 hex 全部改为 var()（清单见下文「Token 化改动面」）。
- **生物绘制替换机制**：canvas 绘制函数（reef.js、web/creatures/*）当前硬编码颜色（清单见下）。改造为：绘制前从 `getComputedStyle(document.documentElement).getPropertyValue(...)` 读取主题色，或由 theme.js 在切换时把 token 表注入一个全局 `THEME` 对象供模块读取。**生物层不做 sprite 贴图替换，按文字规格程序化重绘**（用户硬约束 6：生物资产按文字规格参数化重绘，禁止把 mood 图当成品）——即把 fish.js/shrimp.js 里写死的颜色参数改成读 token，造型算法（轮廓/鳍/尾巴）保留，颜色/描边宽/透明度走 token。
- **切换入口接线**：main.go:252-255 现有托盘菜单 `mygo.NewMenu([]*mygo.MenuItem{...})`。mygo v0.6.0 `MenuItem.Submenu []*MenuItem`（menu.go:105）+ `MenuItemRadio`（menu.go:19）+ `SetChecked` 自动取消同组兄弟勾选（menu.go:247-323）+ `Tray.SetMenu(*Menu)`（modules.go:755）均已存在——**子菜单可行，无需降级**。新增「主题 ▸」子菜单项，每组一项 radio（勾选当前主题），点击 → RPC `Aquarium.SetTheme(id)` → 前端 apply → Go 侧重建托盘菜单刷新勾选态。Tray icon 主题化留作后续（设计文档每主题 menuIcon template 图标属资产层，本期不接）。
- **持久化方案**：**不写 aquarium.json**。在 dataDir 下新增独立小文件 `theme.json`（仅存 `{"theme":"cn-shuimo"}`）。启动时 load：有则用之、无则 reef-realistic；切换时写该文件（这是唯一允许的主题持久化写路径）。回归测试：切换前后对比 aquarium.json 字节——主题文件存在与否都不在其中。RPC 方法新增 `Aquarium.SetTheme`，需跑 `mygo generate` 重生成 bindings.ts 并补 browser.go RPC 白名单（现状 8 个方法：Get/Start/Pause/Resume/End/Feed/SetPreferences/Export/Import，browser.go:70-96 附近）。
- **浏览器模式降级**：`-web` 模式无托盘菜单 → 主题切换入口不可用，默认 reef-realistic（不做 UI 入口，保持现状）。

**Tech Stack:** Go 1.27 + MyGo 0.6.0、`//go:embed web`、WKWebView。测试沿用：

```sh
CGO_ENABLED=0 go test ./...
node --test --test-concurrency=1 tests/*.test.mjs
```

**Spec:** 设计文档 `docs/主题视觉设计方案.html`（v1.0，2026-10-24，未提交）——9 套主题各 10 节规格（色彩/构图/生物/控件/字体/动效/落地备注/token 映射）+ 第 04 章落地框架（theme 包结构、切换入口、工程注意、一致性规则）。**mood 图是 AI 氛围参考，不是成品资产**；落地以文字规格为准。

> 状态：待核验。
> 依据：设计文档全文（节号引用如 §04a/§10.4）+ 代码事实 [C1]–[C12]（见文末附录）+ mygo v0.6.0 源码（menu.go / modules.go 行号）。

## 硬约束与红线（用户已拍板）

1. 主题 = 自包含 theme 包；9 套代号严格用 cn-* / cm-* / ct-*；写实默认纳入契约（reef-realistic）。
2. **硬红线：切换绝不触碰 aquarium.json**——「切换 100 次存档字节级不变」必须有 Go 测试锁定。主题选择持久化到 dataDir 独立 `theme.json`，不进 aquarium.json。
3. 切换入口：菜单栏下拉子菜单（主入口）。设置面板主题页（辅入口）留作后续，本期不做。
4. 兼容系统「减少动态效果」：各主题动效密度按设计文档 0.2×/0.4×/0.5×… 分级落地；减动效下全部静止停靠（设计文档每主题第 9 节给了完整静态方案）。
5. 切换 = 重绑 CSS 变量 + 替换生物绘制引用；**切换不附带庆祝性动效**（设计文档 04c：600ms 交叉淡入可留，减动效下硬切）。
6. 生物层 token 支持成长阶段（coral/seaweed stages，与珊瑚成长玩法对齐），写实主题同样补齐。

## Token 化改动面清单（从现有代码 grep 实测，非推断）

**CSS 层（web/style.css，共 20 行单行压缩文件）：**
- [C1] style.css:1 `:root` 现有 10 变量：--bg/--panel/--panel-light/--line/--text/--muted/--accent/--cyan/--coral/--radius + font-family——是天然的 token 落点。
- [C2] style.css:2-9 硬编码 hex（必须改 var()）：`#0e1d24`(input 底)、`#12303b`/`#294148`/`#20343c`(app-shell 渐变/边框)、`#194250`/`#102e3a`/`#0e252e`(reef-stage 径向渐变)、`#a6dbce18`(light-ray)、`#9ebdbd`(reef-caption)、`#10242a`/`#1c3b41`(reef-bottom)、`#223b39`(mode-tabs active)、`#2b4549`(ring-track)、`#173c31`(primary-button 字色)、`#46777a`/`#213c40`(sound selected)、`#466258`/`#263f37`(sound-toggle)、`#3e6555`/`#1a332c`(notice)、`#1b3035`(visitor 卡)、`#10212a`(journal/review 底)、`#3b5759`(dialog 边框)、`#31444a`/`#557176`(toast) 等约 30 处。

**Canvas 生物层（web/reef.js + web/creatures/）：**
- [C3] reef.js:75-78 礁石色 `#6d8179/#82948a`（4 处）。
- [C4] reef.js:234 沙地描边 `#bd918c`；reef.js:241-245 水草 `#529a86/#70af91/#79b89b/#568d7c`。
- [C5] reef.js:261 水体 `#b4cfb114`；reef.js:267-270 沙地底 `#53675a/#718371/#899781/#566c5e`（含 25 粒沙点）。
- [C6] reef.js:272 满级光晕 `#a8deba08`；reef.js:287-288 鱼食 `rgba(226,194,148)/rgba(255,240,214)`。
- [C7] web/creatures/fish.js 34 处颜色字面量、shrimp.js 14 处、paint.js 4 处——生物造型颜色的主改造面。
- [C8] web/creatures/species.js:15-35 每物种 speed/length/zone 参数（13 物种）——主题漂移速度（driftSpeed token）应作用于此表的乘系数，不改物种行为语义。

**Go 侧：**
- [C9] state.go:18-23 Preferences 结构（focusMinutes/breakMinutes/sound/volume/soundEnabled/chimeEnabled）——**不加 Theme 字段**（红线 2）；theme 选择走独立 theme.json。
- [C10] main.go:164,189-192 dataDir 解析（`-data-dir` flag → 默认 os.UserConfigDir）——theme.json 落在同一 dataDir。
- [C11] main.go:252-255 托盘菜单构建处——插「主题 ▸」子菜单的位置。
- [C12] icon.go（261 行）原生菜单栏小鱼绘制——本期不主题化，保持现状。

## 文件结构（Create / Modify）

**Create：**
- `web/themes/reef-realistic/theme.json` —— 从现有硬编码抽取的 16 token 原值（视觉零回归的基准）。
- `web/themes/<9 个主题 id>/theme.json` —— 按设计文档各 §10 token 映射直填。
- `web/theme.js` —— token→CSS 变量写入 + 全局 THEME 对象供 canvas 读取 + 切换 apply()。
- `theme_store.go` —— theme.json 加载/保存/列表/当前主题 RPC。
- `tests/theme_test.go` —— 字节级不变回归 + schema 校验。

**Modify：**
- `web/style.css` —— 硬编码 hex → var()（清单 [C2]）。
- `web/reef.js`、`web/creatures/*.js` —— 硬编码颜色 → 读 THEME token（[C3]-[C7]）。
- `main.go` —— 托盘菜单加「主题 ▸」子菜单（[C11]）。
- `browser.go` —— RPC 白名单加 GetTheme/SetTheme。
- `bindings.ts` —— `mygo generate` 重生成（注意：产物先写到根文件 `1`，核对 diff 后 `mv 1 bindings.ts`）。
- `state.go` —— Snapshot 增加 `Theme` 字段（前端首屏渲染正确主题用；该字段只从 theme.json 读，不写回 aquarium.json）。

## Task 分解

### T1：theme 包骨架 + reef-realistic 抽取
- [ ] 定义 Go Theme struct（meta/tokens/assets，按设计文档 §04a 结构）。
- [ ] 写 `web/themes/reef-realistic/theme.json`：把 style.css:1 + reef.js/creatures 现有硬编码值逐字填进 16 token（不改任何视觉）。
- [ ] theme.js：加载 reef-realistic token → 写 `:root` 变量；把 style.css 的 var() 改造跑通（先 10 个既有变量，后逐处替换硬编码）。
- [ ] 测试先行：node 测试锁定「reef-realistic token 表 == 当前 :root 变量值快照」。
- 验收：全量现有测试绿；浏览器模式截图与改造前逐屏一致（人工复核 main/review/settings 三屏）。

### T2：切换入口 + 持久化 + 存档回归测试
- [ ] theme_store.go：dataDir/theme.json 读写（结构 `{"theme":"<id>"}`，未知 id 回落 reef-realistic）。
- [ ] RPC：GetTheme / SetTheme（挂 Aquarium 服务侧）；browser.go 白名单补两个 case；bindings.ts 重生成。
- [ ] 前端：SetTheme 后 theme.js apply 新 token → 无闪烁重绘。
- [ ] main.go：托盘菜单插「主题 ▸」子菜单（radio 组 + 当前勾选）；切换后 Tray.SetMenu 重建刷新勾选。
- [ ] **Go 测试（红线）**：构造临时 dataDir，记录 aquarium.json 初始字节 → SetTheme 切 N=100 次（含非法 id）→ 断言 aquarium.json 字节与初始完全一致；同时断言 theme.json 内容是最后一次合法切换值。
- 验收：浏览器模式冒烟（SetTheme via curl RPC）；桌面真机托盘子菜单出现、勾选随切换移动（用户复现步骤）。

### T3：九套主题逐套落地（家族渐进）
- [ ] 先打样一套（建议 cm-cel——设计文档自称「与现有写实气质最接近」，token 映射在 §10 最完整）。
- [ ] 同族三连（cm-pop / cm-ink），再 cn 家族（cn-shuimo → cn-qinghua → cn-qinglu），再 ct 家族（ct-cream → ct-strawberry → ct-jelly）。
- [ ] 每套合入门禁（设计文档 §04d）：对比度数值照设计文档实测值核对、bubbleDensity/driftSpeed ≤1.0×、ambientAudio.defaultOn=false、schema 校验通过。
- 验收：每合一套，浏览器模式截图三屏存证；「减少动态效果」开启下该主题静止。

### T4：生物参数化重绘
- [ ] 把 [C3]-[C7] 的 canvas 硬编码改为读 THEME token；造型算法（轮廓/鳍/运动）不动。
- [ ] 生物层 token 支持成长阶段：coral/seaweed 的 stages 数组（设计文档 §04a：与珊瑚成长玩法对齐）。
- [ ] driftSpeed/bubbleDensity 以乘系数作用于 species.js 行为（[C8]）。
- 验收：node 测试锁定「换主题后同一物种 drawPortrait 颜色来自 token 而非常量」。

### T5：验收页 + 全量测试 + 复现步骤
- [ ] 浏览器模式加临时 `?theme=<id>` 验收参数（或 headless 截图脚本），逐主题出三屏截图。
- [ ] 全量 Go + node 测试绿。
- [ ] 交付说明：改动文件清单 + 行号 + 用户复现步骤（浏览器模式看主题、桌面模式托盘切换、减动效验证、100 次切换回归）。

## Non-goals

- 设置面板主题页（设计文档推荐辅入口）——后续迭代。
- 菜单栏图标（menuIcon）随主题换图——资产层后续。
- 深色模式 / 系统外观跟随——九套均浅色，meta.supportsDarkAppearance:false 显式声明（§04c）。
- 环境音（ambientAudio）实际接线——token 先落地，defaultOn 恒 false，音频合成后续。
- mood 图当资产使用——禁止；全部按文字规格参数化绘制。
- 切换过渡庆祝动效（印章/波纹/金线）——设计文档标注「需产品评审后排期」，本期只做 600ms 交叉淡入（减动效下硬切）。

## 附录：代码事实清单

- [C1] style.css:1 `:root{--bg:#0c1820;--panel:#12232b;--panel-light:#172c32;--line:#254047;--text:#e3ede9;--muted:#8ca7a7;--accent:#a8deba;--cyan:#83c8cc;--coral:#e6b48b;--radius:20px;font-family:"PingFang SC",...}`
- [C2] style.css:2-9 硬编码 hex 约 30 处（详见上文清单）。
- [C3]-[C7] reef.js:75-78,234,241-245,261,267-270,272,287-288；fish.js 34 处、shrimp.js 14 处、paint.js 4 处颜色字面量。
- [C8] species.js:15-35 物种行为参数表。
- [C9] state.go:18-23 Preferences 字段。
- [C10] main.go:164 flag、189-192 dataDir 解析。
- [C11] main.go:252-255 托盘菜单 NewMenu。
- [C12] icon.go 原生托盘图标（261 行），本期不动。
- mygo v0.6.0：MenuItem.Submenu（menu.go:105）、MenuItemRadio（menu.go:19）、SetChecked 同组互斥（menu.go:247-323）、Tray.SetMenu（modules.go:755）、Tray.SetIcon（modules.go:733）。
