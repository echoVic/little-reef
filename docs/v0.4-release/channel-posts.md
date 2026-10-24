# 六渠道帖子成稿（v0.4 定稿，可直接粘贴）

> 来源：飞书物料定稿 docx/OQ8Qd9SaHokTnUxW7zCcSSIbncf（revision 5，2026-10-24）。
> **节奏（Q7）**：W4（11-16 周一 Release 先行 → 周二 HN/PH → 周三 V2EX/即刻 → 周四少数派 → 周六小红书）。**所有发帖动作待用户逐项确认。**

## 2.1 Hacker News（Show HN）

**用途**：英文主渠道，投放节奏见 Q7（北京时间周二晚 = 美东周二上午）。

**标题**（67 字符，符合 HN 上限）：

```text
Show HN: Little Reef – A no-pressure focus timer that grows a reef
```

**正文**（粘贴后附 GitHub + 官网链接各一条，HN 正文不支持格式，纯文本）：

```text
Hi HN — I made Little Reef, a quiet focus timer for macOS. You start a 25-minute session and a little reef in the window grows as you focus. Fish, shrimp and crabs occasionally drop by and get recorded in a collection log.

A few things I deliberately left out:

- No penalties. Stop halfway or walk away — nothing dies, nothing is lost, and the time you did spend still gets recorded.
- No streaks, no goals, no reminders. The review panel shows your week and month, but it never renders a broken streak or nags you back.
- No account, no telemetry. Records live in a local JSON file, and you can export a backup any time from Settings.
- No sounds out of nowhere — it never makes noise unless you ask it to.

It also has 20 ambient sounds (waves, rain, campfire, café…) that ship inside the app and loop without a seam, and it can shrink to a desktop widget or a menu-bar item with a tiny swimming fish.

Tech: Go with the MyGo framework, the front end embedded via go:embed (no JS build step), rendered by the system WKWebView. MIT licensed; the sounds are public-domain recordings, each credited in the repo.

Apple silicon only for now (macOS 12+). The framework can build for Windows/Linux but I haven't tested those, so I'm not shipping binaries I can't stand behind.

Happy to answer anything. Source: https://github.com/echoVic/little-reef — site: https://reef.echovic.com
```

**FAQ 备答**（评论区常见问题，逐条备好）：

1. **"Why arm64-only?"** — The auto-update chain and the notarized app are built and tested on Apple silicon. The framework supports other platforms and you can build from source, but I don't want to publish binaries I've never run.
2. **"What does it send anywhere?"** — Nothing. No account, no telemetry, no network calls except the update check and links you click. Records are one local JSON file, exportable from Settings.
3. **"How is this different from Forest?"** — Forest is a lovely product, but it punishes: leave the app and the tree dies. Little Reef never punishes — walk away and your partial time is still recorded, nothing dies, nothing is lost. It's also Mac-native (menu bar + widget) and open source.
4. **（备用）"Roadmap?"** — Short and evidence-driven: fix what release feedback surfaces first. Sound mixing and other platforms are candidates, gated on what users actually ask for.

## 2.2 Product Hunt

**用途**：英文第二渠道，周二发起，与 HN 错开一天。

- **Tagline**（39 字符）：Grow a little reef with your focus time
- **一句话描述**：A no-pressure focus timer for Mac. Sessions grow a reef, visitors drop by and stay in a log, 20 ambient sounds loop seamlessly — no streaks, no nagging, nothing uploaded.
- **Gallery**：演示视频（PH 主视觉位）+ 5 张截图，顺序与说明如下（截图说明即 alt 文案）：

| # | 截图内容 | 说明文案 |
|-|-|-|
| 1 | 主窗口专注中（左海底右计时，菜单栏小鱼游动） | Your reef on the left, the timer on the right — a menu-bar fish swims while you focus |
| 2 | 访客图鉴（小丑鱼画像 + 「来过 N 次」） | First session brings a clownfish; 15 species in all, remembered forever |
| 3 | 「这段时间」回顾面板展开态 | This week, this month, the days you focused — records only, never reminders |
| 4 | 声音面板（20 种背景音） | 20 ambient sounds, all offline, loop without a seam |
| 5 | 桌面挂件模式（角落小窗 + 倒计时） | Shrinks to a corner widget with just the reef and the countdown |

- **Maker comment**（发布后 30 分钟内跟评）：

```text
Hi Product Hunt! I'm the maker of Little Reef — a one-person, open-source side project.

Most focus timers felt like they were grading me: streaks to keep, trees that die, red badges when I slipped. I wanted the opposite — something that just keeps me company while I work.

So in Little Reef, nothing ever dies, nothing nags you, and nothing leaves your Mac. Sessions quietly grow a reef; fish and crabs drop by and stay in a log. v0.4 adds a gentle review panel (your week, your days, your collection — no streaks anywhere) and one-click archive export/import for backups.

It's free and MIT-licensed, and every ambient sound is a public-domain recording credited in the repo. Happy to answer anything in the comments!
```

## 2.3 V2EX（分享创造节点）

**用途**：中文主渠道，周三上午发帖。

**标题**：

```text
小海底：用专注时间养出一片海底的 macOS 计时器（MIT 开源，v0.4 新增回顾面板与存档备份）
```

**正文**（约 460 字）：

```text
大家好，分享一个自己做的 macOS 专注计时器：小海底（little-reef）。

用法很简单：按空格开始一轮专注（默认 25 分钟），每完成一轮，左边的海底就成长一点；每三轮多一株植物，长满为止。偶尔会有新的鱼、虾或螃蟹来做客，记进图鉴，一共 15 位朋友，没见过的先来。

它和常见番茄钟最大的不同是「无压力」：中途停下或者直接走开，没有鱼会死、也不会扣掉什么，投入过的时间照样记录；不显示连续打卡，没有目标和提醒，不会突然出声。记录只保存在本机，没有账号、不上传——换机时可以在设置里一键导出存档，导入回去一切如初。

20 种背景音（海浪、雨声、篝火、咖啡馆、木鱼、卡农……）全部打包在应用里，循环听不出接缝，播放不联网。窗口可以收成桌面挂件，或者收进菜单栏，专注时菜单栏有一条小鱼轻轻游动。

v0.4 刚加了「这段时间」回顾面板：本周、本月、一起度过的天数、图鉴进度，展开就能看，全部是正向记录——不渲染中断、不设目标、不打扰。存档导出/导入同版往返无损。

技术栈：Go + MyGo 桌面框架，前端 go:embed 直接内嵌、没有 JS 构建步骤，WebView 用系统自带的 WKWebView，MIT 开源，背景音是公共领域录音，出处都在仓库里。

需要 macOS 12+ 和 Apple 芯片，免费。欢迎试试：
官网：https://reef.echovic.com
源码：https://github.com/echoVic/little-reef
```

**配图说明**（3–5 张，帖内依序插入）：

1. 主窗口专注中：左海底右计时（开场图，体现产品形态）
2. 访客图鉴：小丑鱼来访记录（体现「来过 N 次」）
3. 「这段时间」回顾面板展开态（v0.4 主特性）
4. 桌面挂件 + 菜单栏小鱼（体现形态差异）
5. 设置里的「备份与恢复」（体现存档安全网）

**回复预案**（按 V2EX 社区高频问题各备一条）：

1. **「为什么只有 macOS / 只有 arm64？」**——如实：自动更新链按 macOS 设计、我在 Apple 芯片上开发测试；Win/Linux 可源码构建但没实测过，不想发自己没跑过的包。等有真实诉求再排期。
2. **「为什么不做 iOS / 云同步？」**——隐私是承诺不是短板：无账号、不上传是官网写明的承诺；换机走存档导出，成本近零。云同步会推翻这条产品线，宁可不做。
3. **「和 Forest 有什么区别？」**——Forest 中途离开树会枯死（惩罚机制）；小海底不惩罚，提前结束也记录时间、什么都不死。另外小海底是 Mac 原生（菜单栏/挂件）且开源。

## 2.4 即刻

**用途**：短动态，周三晚，投「独立开发者」「效率工具」两个圈子。

**动态正文**：

```text
一个人做的小产品：小海底。按空格开始专注，每完成一轮，桌面上的海底就长大一点；偶尔有鱼虾螃蟹来做客，记进图鉴。中途走开也不会死鱼，不打卡、不催促、不上传。收进菜单栏，专注时有一条小鱼陪你游。

v0.4 新增「这段时间」回顾：本周专注、一起度过的天数、图鉴进度——只做记录，从不提醒。

免费开源（MIT），Apple 芯片 Mac 可用：reef.echovic.com
```

**图组**（4 图，每图配一句话）：

1. 专注中：左边海底生长，右边计时走动 —— 配文：专注时，它就慢慢长
2. 小丑鱼来访，图鉴记下第一位朋友 —— 配文：第一位朋友总会来
3. 「这段时间」面板：本周专注与天数 —— 配文：数字只是陪着，不是成绩单
4. 收成挂件后的桌面一角 —— 配文：不用的时候，它就安静待在角落

**圈子 tag**：#独立开发者 #效率工具

## 2.5 少数派（sspai 投稿）

**用途**：周三投稿（审核有延迟，宜早投），800–1500 字，工作流场景切入。

**标题**：小海底：一款从不催你的 Mac 专注计时器

**正文**（约 980 字）：

```text
番茄钟工具大概分两类：一类游戏化很重，任务、勋章、商店，专注本身反而成了支线剧情；另一类极简到只剩一个倒计时，走不走完全靠自己。小海底（little-reef）想试试第三种：让专注本身有一点温柔的回报，但不给你任何压力。

它是一个 macOS 应用，开源（MIT）、免费。一句话概括：你专注，桌面上的海底就慢慢长大。

专注：按空格开始一轮，默认 25 分钟。窗口左半边是一片水下世界：水草会随完成的轮数长高，每三轮多一株植物，虾和螃蟹在沙地上爬、会躲进石缝。专注进行时，菜单栏图标会变成一条轻轻游动的小鱼——不看倒计时，也知道时间在走。

休息：一轮结束，默认休息 5 分钟。休息时可以喂一次鱼：鱼食慢慢下沉，吃剩的落到沙地上，被虾蟹捡走。等一等，也可以不那么难熬。

回看：v0.4 新增「这段时间」折叠面板——本周和本月的专注时长、一起度过的天数、图鉴进度、当前成长阶段，展开就能看。值得注意的是它刻意不显示「连续 N 天」：中断不渲染、不标红、不提醒，只有正向的记录。数字是陪伴，不是 KPI。

访客：图鉴是另一条温柔的线。第一轮专注必定遇见小丑鱼，之后每轮有三分之一的机会来一位新朋友——4 种鱼、6 种虾、5 种蟹，全部按真实物种绘制，没见过的先来。都见过之后，老朋友会再来做客。

「无压力」不是口号，是几条硬规则：中途停下或直接走开，没有鱼会死，投入过的时间照样记录；不显示打卡和目标，不发提醒推送；从不突然出声，第一次打开也不会；Mac 休眠的时间不算进专注。

隐私上同样干净：没有账号，不上传任何东西，你的记录就是本地的一个文件。想换机或备份，v0.4 可以在设置里一键导出存档；导入前会校验，失败不会影响当前数据，导出再导入，内容完全一样。

其它细节：20 种背景音（海浪、雨声、篝火、咖啡馆、木鱼、卡农……）全部打包在本机，循环听不出接缝；窗口可以收成桌面挂件，或者收进菜单栏；系统开启「减少动态效果」时会自动停下所有动画，只留计时。

它需要 macOS 12 或更高、Apple 芯片的 Mac。官网 reef.echovic.com 有完整介绍和下载，源码在 GitHub（echoVic/little-reef）。如果你也想要一个不催你的专注计时器，可以试试。
```

**配图建议**（随投稿附）：主窗口专注图、「这段时间」面板、挂件模式、图鉴页 4 张（沿用官网新截图）。

## 2.6 小红书

**用途**：周六发，生活化口吻，竖版图组（3:4）。

**笔记标题**（20 字内）：桌面角落，养了一片小海底

**首图文案**（竖版封面，两行大字）：

```text
专注的时候
它就悄悄长大
```

**正文**：

```text
最近把 Mac 的角落让给了一片海。

开始专注它就慢慢长，暂停也不催你，走开了也不会死鱼。
一轮结束偶尔有鱼虾来做客，图鉴会一直记着，现在集了 5 位。

20 种白噪音都在本机：海浪、咖啡馆、木鱼、卡农，换着听，循环听不出接缝。
不用的时候收起来，只剩角落一个小挂件，或者躲进菜单栏变成一条小鱼。

没有打卡，没有提醒，记录只存在自己电脑里，想备份随时导出。

免费开源，Apple 芯片的 Mac 可以试试。
```

**图组**（5 图竖版，依序）：

1. 封面：挂件在干净桌面的角落（首图两行大字）
2. 主窗口：海底生长中 + 计时器
3. 图鉴：第一位朋友小丑鱼
4. 「这段时间」面板：本周专注与一起度过的天数
5. 声音面板 + 挂件对比图

**话题标签**：#macOS #桌面美化 #桌面小组件 #效率工具 #专注 #白噪音 #开源软件 #独立开发
