# 小海底桌面水族馆

用专注时间养出一片小海底。Go 后端管理计时和存档，网页界面绘制水族馆，三种背景音由 Web Audio 离线合成。前端已随 Go 程序嵌入，不需要 Bun、前端构建或音频下载。

## 功能

- 默认 25 分钟专注、5 分钟休息，可在设置中调整；新时长从下一轮开始。
- 开始、暂停、继续、提前结束；任务名称可选。空格键可开始或暂停。
- 完成一轮增加成长：水草逐渐长高，每三轮增加一株植物，成熟后维持有限数量，避免画面拥挤。
- 首轮必定遇见小丑鱼，后续完成轮次有三分之一机会遇见访客；图鉴记录长期保存。
- 每次休息可喂鱼一次，无需连续点击或照料；中断和离开不会死鱼或扣除装饰。
- 海浪、雨声、水下气泡单选，独立音量与开关，淡入淡出、连续循环。
- 开始与继续专注时按声音开关播放，暂停、结束和完成时停止；休息默认静音，可主动开启。
- 完成提示音单独控制。静音时仍有完成文字反馈与系统通知。
- 桌面挂件模式、托盘收起和全局快捷键 `CmdOrCtrl+Shift+A`。
- 专注进行时，菜单栏的小鱼会轻轻游动；暂停或休息时安静停住。

## 运行与打包

需要 Go 1.27.1 或更高版本。以下命令从本项目根目录执行：

```sh
CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=4GiB GOFLAGS=-p=2 go run .

# 使用同一 Go 后端在浏览器中运行（仅回环地址）。
CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=4GiB GOFLAGS=-p=2 go run . -web 127.0.0.1:4173

# 生成各平台安装产物，写入 build。
CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=4GiB GOFLAGS=-p=2 go tool mygo build .
```

桌面版使用系统 WebView：macOS 的 WKWebView、Windows 的 WebView2、Linux 的 GTK 3 与 WebKitGTK 4.1（或 4.0）。Linux 托盘需要 Ayatana AppIndicator，缺失时降级为普通窗口，收起操作改为最小化。Wayland 下窗口定位由合成器决定。

品牌图标（计时圆环中的小鱼）在 `icon.go` 中绘制：菜单栏使用单色模板图，Dock 与打包产物使用圆角底版。修改绘制代码后运行 `go run . -export-icons` 重新生成 `assets/icon.png`、`web/favicon.png` 与 `web/mark.png`，其中 `assets/icon.png` 由 `mygo build` 转为各平台安装产物使用的图标。

### Mac 下载包

跨平台 `mygo build` 生成的 `.app` 只有可执行文件的链接器签名，不能直接作为完整签名的 Mac 分发包。使用 `package-macos.sh` 对整个 bundle 签名后再封装；macOS 使用系统 `codesign`，其他构建主机需安装 `rcodesign`。

```sh
bash package-macos.sh \
  build/darwin-arm64/小海底.app \
  /tmp/小海底-Mac修正版.zip
```

该脚本产出临时签名演示包，包含 `启动小海底.command` 和打开说明。首次使用启动文件会在用户 Mac 上对同目录的小海底重新签名、校验，并移除仅该应用的下载隔离属性，然后打开应用。不会关闭 Gatekeeper 或请求管理员密码。完整 Developer ID 签名与 Apple 公证需要在正式分发流程中配置，临时签名不能替代它们。

## 存档与时间规则

桌面存档位于 mygo 的 `PathUserData` 目录，文件名 `aquarium.json`。浏览器模式使用独立的 `mygo-aquarium-browser` 配置目录。`-data-dir` 可指定另一目录进行隔离运行；同一存档目录仅应由一个实例写入。

专注和休息的计时由 Go 管理，页面隐藏不影响计时。电脑休眠或超过五秒的调度中断会暂停，休眠期间不计入专注。正常退出会保存并暂停当前计时；重新打开保持静音，需主动继续。运行时每三十秒保存一次检查点，正常退出和重要操作立即保存。

提前结束记录已投入的秒数，但不奖励新的成长。完成休息不会增加成长。日记保留最近一千条，总时长和成长长期保留；界面展示最近三十条日记。

## 背景音说明

背景音是本地生成的自然氛围合成音，不是实录音频。每种声轨通过固定种子噪声、滤波与柔和气泡生成，循环接缝交叉淡化。首次不自动播放；保存声音类型、音量与专注播放开关，重启不会自动出声。系统不支持 Web Audio 或播放受限时提示用户，计时继续工作。

## 验证

```sh
CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=4GiB GOFLAGS=-p=2 go test -p 2 -parallel 2 ./...
```

测试覆盖暂停恢复的实际时间、提前结束、完成仅结算一次、访客存档、休眠暂停、恢复设置、休息不奖励成长和保存失败回滚。

## 项目来源

基于 [MyGo](https://github.com/egoist/mygo) 桌面框架构建。框架版本固定到开发时使用的提交，通过 Go Modules 下载；应用源码独立维护。上游 MIT 许可声明见 [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt)。
