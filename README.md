# 小海底

简体中文 | [English](README.en.md)

用专注时间养出一片小海底。每完成一轮专注，水草就长高一点，偶尔还会有鱼、虾或螃蟹来做客。这是一个安静的桌面专注计时器，带水族馆、访客图鉴和 20 种背景音。

## 下载

需要 macOS 12 或更高版本，以及 Apple 芯片的 Mac。到 [Releases](https://github.com/echoVic/little-reef/releases) 下载最新的 `little-reef-<版本>-macos-arm64.dmg`，打开后把「小海底」拖进「应用程序」。

Windows 和 Linux 暂时没有安装包，可以[从源码构建](#从源码构建)。

## 功能

- **专注与休息**：默认专注 25 分钟、休息 5 分钟，可以在设置里改，新时长从下一轮开始生效；支持开始、暂停、继续、提前结束和可选的任务名，空格键开始或暂停。
- **水族馆**：每完成一轮，水草长高，每三轮多一株植物；第一轮必定遇见小丑鱼，之后每轮有三分之一的机会遇见访客——4 种鱼、6 种虾、5 种蟹，没见过的先来，15 位都见过之后老朋友会再来。图鉴一直保存。
- **喂鱼**：每次休息可以喂一次，鱼食下沉，吃剩的由虾蟹捡走；中断或离开也不会死鱼，不扣装饰。
- **背景音**：20 种背景音，除粉红噪音是实时合成，其余都是公共领域的录音；每条可单独调音量和开关。完成提示音可以单独开关，静音时仍有文字提示和系统通知。
- **桌面与菜单栏**：桌面挂件、收起到菜单栏、全局快捷键 `CmdOrCtrl+Shift+A`；菜单栏的小鱼专注时游动、暂停时停住，点开是快捷面板。系统开启「减少动态效果」时动画静止，计时和声音照常。
- **主题**：10 套海底皮肤；可以按时段自动切换（06:00 马卡龙、10:00 赛璐璐、17:00 青绿江山、20:00 深海写实），也可以每 30 分钟从全部皮肤随机轮换。
- **记录**：「这段时间」面板显示本周、本月和累计的专注时长与轮数、一起度过的天数、图鉴进度和当前成长阶段；只做正向记录，没有连续打卡和目标提醒。
- **设置与备份**：通用、外观、快捷键、备份与恢复四个标签页；快捷键可以单独录制、停用或恢复默认，冲突会提示。「备份与恢复」把整个存档导出成带版本号的 JSON，导入前校验，失败时当前存档不变。

## 存档与计时

- 计时由 Go 后端负责，窗口隐藏或收进菜单栏都不影响。
- 电脑休眠，或程序被系统挂起超过 5 秒，计时自动暂停，休眠时间不计入专注。
- 运行时每 30 秒自动保存，正常退出和重要操作立即保存；退出时暂停当前计时，重新打开后保持静音。
- 提前结束会记录已投入的时间，但不增加成长；完成休息也不增加成长。
- 存档是 `aquarium.json`，在 macOS 的 `~/Library/Application Support/小海底`；`-data-dir` 可以指定其他目录。日记保留最近 1000 条，界面显示最近 30 条。

## 从源码构建

需要 Go 1.27.3 或更高版本，以及 Node.js 22+。

```sh
cd web
npm ci --registry=https://registry.npmjs.org/
npm run typecheck && npm test && npm run build   # 产出 web/dist
cd ..

CGO_ENABLED=0 go test ./...
CGO_ENABLED=0 go run .                            # 桌面版
CGO_ENABLED=0 go run . -web 127.0.0.1:4173        # 浏览器模式，只监听回环地址
CGO_ENABLED=0 go tool mygo build -sign=- -skip-notarize .   # macOS 应用和 dmg，输出到 build/darwin-arm64
```

Go 二进制通过 `//go:embed` 打包 `web/dist`、主题、背景音和物种表；没有构建 `web/dist` 时启动会明确报错退出。更换背景音见 `build-sounds.sh`，更换图标见 `go run . -export-icons`。

## 测试

前端在 `web/` 里跑 `npm run typecheck`、`npm test` 和 `npm run build`；Go 侧用 `CGO_ENABLED=0 go test ./...`。覆盖计时、存档回滚、物种遇见顺序、背景音总量、减少动态效果和快捷键校验。

## 致谢与许可

基于 [MyGo](https://github.com/egoist/mygo) 构建，第三方许可见 [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt)。源代码以 [MIT](LICENSE) 开源；`web/public/sounds` 里的录音属于公共领域，出处同样在 [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt)。
