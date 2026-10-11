# 背景音换成真实录音 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 除粉噪外的 19 种背景音换成打包进程序的 CC0 实地录音，循环听不出接缝，交互保持不变。

**Architecture:** `build-sounds.sh` 下载 Freesound 的高码率试听版，截取片段、对齐响度，在 4 倍过采样下限幅，再编码成 MP3 写入 `web/sounds/`，由现有的 `//go:embed web` 打包进程序。选中某种声音时，`web/audio.js` 读取并解码对应的 MP3，在解码后的缓冲区里原地做等功率交叉淡化，再交给 `AudioBufferSourceNode` 原生循环播放。粉噪保留实时合成。

**Tech Stack:** Go 1.27（embed、testing）；Web Audio API；bash 3.2、curl、ffmpeg 8（libmp3lame、ebur128、alimiter）；本机 Google Chrome 无头模式（只用于验收，不提交）。

**Spec:** `docs/superpowers/specs/2026-10-11-real-ambience-recordings-design.md`

本计划里的录音选择、截取位置、响度数字、文件大小和全部代码，都已按计划原样在临时目录里跑过：
- 脚本两次运行，产出的文件逐字节相同；
- 验收页在新 `audio.js` 上通过，在旧 `audio.js` 上失败；
- Go 测试先失败、后通过；
- 浏览器模式下页面没有报错。

## 与设计文档的差异（规划时实测后的调整，请一并确认）

1. **部分声音会比原来轻。** 设计要求每条录音和它替换的合成声音相差不超过 ±1 LU，真峰值不超过 −1 dBTP。实地录音的峰值比合成声音高得多，硬拉到目标响度，浪头、雷声和柴火的噼啪声都会被压扁。所以改为每条最多压限 3 dB；溪流和篝火的峰值是短促的水花和噼啪声，放宽到 6 dB；仍够不到目标的，宁可轻一些。实测与目标的差距：海浪 −0.8、雷雨 −2.4、深海 −0.7、风声 −3.7、篝火 −5.7、车流 −0.4 LU。其余 13 条与目标相差不超过 0.1 LU。
2. **限幅在 4 倍过采样下进行。** 只在原采样率下限幅时，篝火编码后的真峰值是 −0.5 dBTP。先升到 4 倍采样率限幅、再降回原采样率后，19 条都在 −1.5 dBTP 以下。
3. **96 kHz 的试听版降到 48 kHz。** MP3 最高只支持 48 kHz，有 6 条试听版是 96 kHz。
4. **咖啡馆片段是 55 秒。** 选中的录音只有 60 秒，达不到事件型 75–90 秒的要求。
5. **合计 27.0 MB。** 在 30 MB 上限之内。程序从 14.7 MB 变为 41.9 MB。`mygo build` 会把 `web/` 再嵌入一次，实测 Go 链接器会合并相同内容，体积不会翻倍。
6. **解码失败时，旧声音也会停下。** 否则界面上选中的是新声音，耳朵里听到的还是旧声音。

## Global Constraints

- 只用 Freesound 上 CC0 1.0 授权的录音；`THIRD_PARTY_NOTICES.txt` 列出每条录音的标题、作者和链接。
- 声音的 ID、名称和顺序不变；`state.go` 的偏好校验不变；`app.js` 不改。
- `Soundscape` 对外接口不变：`unlock()`、`set(playing, sound, volume)`、`chime()`、`dispose()`。
- 循环使用 `AudioBufferSourceNode` 的原生 `loop`、`loopStart`、`loopEnd`，播放期间不依赖定时器。
- 粉噪保留原合成算法：种子 211，18 秒。
- MP3 用 LAME VBR `-q:a 2`，采样率不超过 48 kHz，保留源声道数；`web/sounds/` 合计不超过 30 MB。
- 每个 MP3 的真峰值不超过 −1 dBTP。响度目标是被替换合成声音的实测值，压限上限见上面第 1 条。
- `build-sounds.sh` 兼容 macOS 自带的 bash 3.2，需要 curl、ffmpeg 5 或以上（含 libmp3lame）和网络；平时构建和运行都不需要它。
- 读取或解码失败时的提示文字：`这段声音暂时无法播放，计时不受影响`。
- 用户可见文字用中文，代码注释用英文，风格与现有代码一致。
- Go 测试命令：`CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=4GiB GOFLAGS=-p=2 go test -p 2 -parallel 2 ./...`

## Review Focus

1. 录音还在解码时连续切换声音，只能响起最后选中的那个，不能两个叠着放（Task 2 验收页第 3 项）。
2. 录音还在解码时关掉声音，解码完成后也不能出声（第 4 项）。
3. 切回刚听过的声音时，直接用内存里的解码结果，不重新读取文件；内存里最多保留两种（第 5 项）。
4. 某条录音无法解码时（例如 Linux 缺少 MP3 插件），旧声音停下并弹出提示，计时照常（第 6 项）。
5. WebKit 解码 MP3 时会保留编码器在开头补的约 25–50 毫秒静音（macOS 的 `afinfo` 把 31.5 秒的文件报告为 31.536 秒）。即使这样，时钟和木鱼的接缝也要落在两次敲击之间（第 2 项）。

## 已选录音

可以点链接在 Freesound 上试听。每种声音还各有两条备选，写在 `build-sounds.sh` 表格的注释行里。

| 声音 | 录音（作者）与内容 | 截取 | 实测响度 / 目标（LUFS） |
|---|---|---|---|
| 海浪 waves | [Big waves hit land.wav](https://freesound.org/s/412308/)（straget）：波罗的海岸边的浪 | 148 秒起，90 秒 | −16.4 / −15.6 |
| 雨声 rain | [Rain_06.wav](https://freesound.org/s/56311/)（Q.K.）：大雨打在屋顶上 | 44 秒起，60 秒 | −15.7 / −15.7 |
| 雷雨 thunder | [Rain and thunder in Thailand](https://freesound.org/s/447510/)（felix.blume）：傍晚的雨，片段里有两声远雷 | 755 秒起，90 秒 | −18.9 / −16.5 |
| 溪流 stream | [Gentle Stream Natural Stream Sound](https://freesound.org/s/446019/)（BurghRecords）：苏格兰的小溪 | 1 秒起，60 秒 | −15.3 / −15.2 |
| 气泡 bubbles | [aquarium filter bubbling close.flac](https://freesound.org/s/635477/)（kyles）：水族箱过滤器冒泡 | 26 秒起，60 秒 | −24.8 / −24.8 |
| 煮沸 boil | [pot metal on hot stove water simmering1.flac](https://freesound.org/s/635619/)（kyles）：炉子上锅里的水微微沸腾 | 0 秒起，60 秒 | −16.0 / −16.0 |
| 深海 deepsea | [Underwater Ambience](https://freesound.org/s/393819/)（Kinoton）：水下的低沉声和气泡，作者做过降调处理 | 26 秒起，60 秒 | −18.0 / −17.3 |
| 风声 wind | [Wind is blowing in the grass of a patagonian plain…](https://freesound.org/s/139337/)（felix.blume）：巴塔哥尼亚草原上的风 | 82 秒起，60 秒 | −20.8 / −17.1 |
| 篝火 fire | [campfire in a forest at night.wav](https://freesound.org/s/248303/)（Duophonic）：夜里林中的篝火，背景有树叶声和蟋蟀 | 61 秒起，60 秒 | −24.7 / −19.0 |
| 森林 forest | [wind in the trees](https://freesound.org/s/150174/)（deleted_user_229898）：林间的风声和鸟鸣 | 13 秒起，90 秒 | −19.1 / −19.1 |
| 夏日 summer | [AkasakaHieJinjaCicadas_4mics.wav](https://freesound.org/s/79086/)（markystar）：东京日枝神社的蝉鸣 | 44 秒起，60 秒 | −20.9 / −21.0 |
| 夏夜 night | [Night Woods](https://freesound.org/s/532301/)（widgetstudios）：夜晚树林里的蟋蟀和螽斯 | 62 秒起，90 秒 | −25.9 / −25.9 |
| 沙漠 desert | [Wind blowing into some cactus spine… Atacama](https://freesound.org/s/156414/)（felix.blume）：阿塔卡马沙漠山顶的风 | 24 秒起，60 秒 | −17.8 / −17.7 |
| 晨间 morning | [Dawn Chorus Birdsong](https://freesound.org/s/573080/)（squashy555）：清晨四点的鸟群合鸣 | 388 秒起，90 秒 | −22.7 / −22.7 |
| 时钟 clock | [TicTac of a wall clock](https://freesound.org/s/170445/)（felix.blume）：近距离录的挂钟，每秒一声“嘀嗒” | 0.059 秒起，31.5 秒 | −28.7 / −28.7 |
| 木鱼 knock | [Mokugyo.wav](https://freesound.org/s/607215/)（jonopodmore）：高野山的小木鱼，只有一下敲击 | 排成 22 下，每 1.35 秒一下 | −30.3 / −30.3 |
| 咖啡馆 cafe | [Coffee Shop.wav](https://freesound.org/s/404478/)（Trainscough5407）：咖啡馆环境声，以交谈为主 | 5 秒起，55 秒 | −18.7 / −18.7 |
| 音乐盒 musicbox | [Music Box.wav](https://freesound.org/s/158206/)（Rickbrewin）：老音乐盒演奏勃拉姆斯摇篮曲，上传者给它加了“creepy”（阴森）标签 | 整段 33.8 秒，每 16.94 秒一遍 | −22.4 / −22.4 |
| 车流 traffic | [Downtown LA, Little Tokyo, late night semi distant traffic.wav](https://freesound.org/s/330427/)（janbezouska）：深夜在洛杉矶一栋楼的四楼听到的车流 | 68 秒起，90 秒 | −16.0 / −15.6 |

## 文件结构

- 新建 `build-sounds.sh`：录音表，加上下载、截取、对齐响度、限幅、编码、复测和预算检查。只在更换录音时运行。
- 新建 `web/sounds/<id>.mp3`：19 个文件，由脚本生成，提交进 git。
- 新建 `sounds_test.go`：检查每种录音都已嵌入、确实是 MP3、合计不超过 30 MB。
- 修改 `state_test.go`：把声音列表提成包级变量 `advertisedSounds`，两个测试共用。
- 修改 `THIRD_PARTY_NOTICES.txt`：追加录音出处。
- 改写 `web/audio.js`：读取录音、原地处理接缝、缓存两种声音、失败时提示；粉噪合成保留。
- 修改 `README.md`：开头的介绍、Linux 依赖、“背景音说明”、测试覆盖范围。
- 一次性验收工具 `check_audio.py` 和 `harness.html`：放在临时目录，不提交。

---

### Task 1: 打包录音

**Files:**
- Create: `build-sounds.sh`
- Create: `sounds_test.go`
- Create: `web/sounds/*.mp3`（19 个，由脚本生成）
- Modify: `state_test.go:151-163`
- Modify: `THIRD_PARTY_NOTICES.txt`（在末尾追加）

**Interfaces:**
- Consumes: 无。
- Produces:
  - `web/sounds/<id>.mp3`：`<id>` 是除 `pink` 外的 19 个声音 ID。采样率 44.1 或 48 kHz；时钟是单声道，其余是立体声。
  - `advertisedSounds []string`：`state_test.go` 里的包级测试变量，按 `index.html` 的顺序列出 20 个声音 ID。
  - Task 2 的接缝参数依赖这些时间点：
    - `clock.mp3`：第一对“嘀嗒”在 0.600 秒，之后每 1.00003 秒一对，每对里的两下相隔约 0.12 秒。
    - `knock.mp3`：第 i 下（i = 0…21）在 0.6 + 1.35·i 秒附近（±25 毫秒），循环周期 29.7 秒；第 0 下在 30.3 秒附近再出现一次；文件长 31.3 秒。
    - `musicbox.mp3`：长 33.8 秒，曲子每 16.94 秒一遍；曲头在 0.32 秒和 16.93 秒，15.06–16.93 秒是曲尾的停顿。

- [ ] **Step 1: 写失败的测试**

把 `state_test.go` 第 151–163 行的 `TestEveryAdvertisedSoundIsAccepted` 整个替换为：

```go
// advertisedSounds pins the sound panel's choices, in the order index.html lists them.
var advertisedSounds = []string{"waves", "rain", "thunder", "stream", "bubbles", "boil", "deepsea", "wind", "fire", "forest", "summer", "night", "desert", "morning", "clock", "knock", "cafe", "musicbox", "traffic", "pink"}

func TestEveryAdvertisedSoundIsAccepted(t *testing.T) {
	p := Preferences{FocusMinutes: 25, BreakMinutes: 5, Volume: .5}
	for _, kind := range advertisedSounds {
		p.Sound = kind
		if err := validatePreferences(p); err != nil {
			t.Errorf("sound %q rejected: %v", kind, err)
		}
	}
	p.Sound = "volcano"
	if err := validatePreferences(p); err == nil {
		t.Error("unknown sound accepted")
	}
}
```

新建 `sounds_test.go`：

```go
package main

import (
	"io/fs"
	"testing"
)

// Every sound except pink noise plays an embedded recording, and together
// they stay within the 30 MB budget.
func TestEveryRecordedSoundIsEmbedded(t *testing.T) {
	total := 0
	for _, kind := range advertisedSounds {
		if kind == "pink" {
			continue // synthesized in the page
		}
		data, err := fs.ReadFile(frontend, "web/sounds/"+kind+".mp3")
		if err != nil {
			t.Errorf("sound %q has no recording: %v", kind, err)
			continue
		}
		// An MPEG audio frame starts with eleven set sync bits.
		if len(data) < 64<<10 || data[0] != 0xFF || data[1]&0xE0 != 0xE0 {
			t.Errorf("sound %q: %d bytes, not an MP3 recording", kind, len(data))
		}
		total += len(data)
	}
	if total > 30<<20 {
		t.Errorf("recordings take %.1f MB, over the 30 MB budget", float64(total)/(1<<20))
	}
}
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=4GiB GOFLAGS=-p=2 go test -p 2 -parallel 2 -run TestEveryRecordedSoundIsEmbedded ./...`

Expected: FAIL，共 19 行 `sound "<id>" has no recording: open web/sounds/<id>.mp3: file does not exist`。

- [ ] **Step 3: 写 `build-sounds.sh`**

```bash
#!/bin/bash
# Rebuild web/sounds from public-domain (CC0) Freesound recordings.
# Needs curl, ffmpeg 5 or later with libmp3lame, and network access; normal
# builds never run it. Rerun after changing a row in the table below.
set -euo pipefail

sounds_dir=$(cd "$(dirname "$0")" && pwd)/web/sounds
sounds_cache=${TMPDIR:-/tmp}/little-reef-sounds
mkdir -p "$sounds_dir" "$sounds_cache"

# Sound, Freesound id, excerpt start and length (s), target loudness (LUFS,
# that of the synthesized track it replaces), the most limiting allowed to
# reach it (dB), and the high-quality preview. "#" rows are alternatives.
# clock, knock and musicbox loop on beats or where the tune ends, as set in
# web/audio.js; a new recording for them needs those values measured again.
sounds_table='
waves    412308 148    90    -15.6 3 https://cdn.freesound.org/previews/412/412308_7707368-hq.ogg
#        241824 https://cdn.freesound.org/previews/241/241824_4404567-hq.ogg waves_1.wav
#        463250 https://cdn.freesound.org/previews/463/463250_7482766-hq.ogg Beach Waves 04.wav
rain     56311  44     60    -15.7 3 https://cdn.freesound.org/previews/56/56311_91374-hq.ogg
#        217236 https://cdn.freesound.org/previews/217/217236_4054839-hq.ogg steady rain in the city.wav
#        188655 https://cdn.freesound.org/previews/188/188655_1178799-hq.ogg 1 Minute Rain (Medium)
thunder  447510 755    90    -16.5 3 https://cdn.freesound.org/previews/447/447510_1661766-hq.ogg
#        158692 https://cdn.freesound.org/previews/158/158692_179538-hq.ogg Distant Thunder and Rain from Half Open Window 1.aif
#        577846 https://cdn.freesound.org/previews/577/577846_10548058-hq.ogg Rain and distant thunder 1
stream   446019 1      60    -15.2 6 https://cdn.freesound.org/previews/446/446019_7241289-hq.ogg
#        236981 https://cdn.freesound.org/previews/236/236981_2258946-hq.ogg Stream Running Into Pond
#        415053 https://cdn.freesound.org/previews/415/415053_7707368-hq.ogg Brook 2.wav (mono)
bubbles  635477 26     60    -24.8 3 https://cdn.freesound.org/previews/635/635477_612689-hq.ogg
#        870769 https://cdn.freesound.org/previews/870/870769_18412227-hq.ogg Aquarium Pump and Bubbles (mono)
#        329622 https://cdn.freesound.org/previews/329/329622_5735740-hq.ogg Aquarium 1.wav (mono)
boil     635619 0      60    -16.0 3 https://cdn.freesound.org/previews/635/635619_612689-hq.ogg
#        420228 https://cdn.freesound.org/previews/420/420228_8375530-hq.ogg 37 - 17 Boiling water.wav
#        380828 https://cdn.freesound.org/previews/380/380828_5763832-hq.ogg Pot of Water Boiling
deepsea  393819 26     60    -17.3 3 https://cdn.freesound.org/previews/393/393819_2247456-hq.ogg
#        366159 https://cdn.freesound.org/previews/366/366159_6725579-hq.ogg Underwater [Loop] AMB.wav
#        482167 https://cdn.freesound.org/previews/482/482167_4838691-hq.ogg Underwater Ambience.wav
wind     139337 82     60    -17.1 3 https://cdn.freesound.org/previews/139/139337_1661766-hq.ogg
#        165526 https://cdn.freesound.org/previews/165/165526_1661766-hq.ogg Wind singing in the mountain
#        181801 https://cdn.freesound.org/previews/181/181801_3153523-hq.ogg breeze.wav
fire     248303 61     60    -19.0 6 https://cdn.freesound.org/previews/248/248303_1001802-hq.ogg
#        145774 https://cdn.freesound.org/previews/145/145774_43834-hq.ogg crackling_fire_021012.wav
#        501417 https://cdn.freesound.org/previews/501/501417_10869493-hq.ogg Aachen Burning Fireplace
forest   150174 13     90    -19.1 3 https://cdn.freesound.org/previews/150/150174_229898-hq.ogg
#        385280 https://cdn.freesound.org/previews/385/385280_2341984-hq.ogg sfx_amb_forest_spring_afternoon-01.wav
#        460178 https://cdn.freesound.org/previews/460/460178_4817223-hq.ogg forest ambience, steady breeze
summer   79086  44     60    -21.0 3 https://cdn.freesound.org/previews/79/79086_384438-hq.ogg
#        272169 https://cdn.freesound.org/previews/272/272169_3186672-hq.ogg Cicadas
#        458113 https://cdn.freesound.org/previews/458/458113_300738-hq.ogg Countryside
night    532301 62     90    -25.9 3 https://cdn.freesound.org/previews/532/532301_2669618-hq.ogg
#        333221 https://cdn.freesound.org/previews/333/333221_2098408-hq.ogg Night Crickets Back Porch.aiff
#        328293 https://cdn.freesound.org/previews/328/328293_1661766-hq.ogg Forest at night in Sian Kaan
desert   156414 24     60    -17.7 3 https://cdn.freesound.org/previews/156/156414_1661766-hq.ogg
#        146436 https://cdn.freesound.org/previews/146/146436_1661766-hq.ogg Dry grass rustling in the wind, desert of Chile
#        457159 https://cdn.freesound.org/previews/457/457159_806506-hq.ogg Desert binaural Wind.WAV
morning  573080 388    90    -22.7 3 https://cdn.freesound.org/previews/573/573080_1149179-hq.ogg
#        270370 https://cdn.freesound.org/previews/270/270370_1992775-hq.ogg Various Birds singing in the Morning
#        165516 https://cdn.freesound.org/previews/165/165516_2022935-hq.ogg Dawn Chorus.mp3
clock    170445 0.059  31.5  -28.7 3 https://cdn.freesound.org/previews/170/170445_1661766-hq.ogg
#        434841 https://cdn.freesound.org/previews/434/434841_1738686-hq.ogg Kitchen Wall Clock Ticking 2
#        171043 https://cdn.freesound.org/previews/171/171043_2449563-hq.ogg Mechanical alarm clock is ticking (5 ticks/s)
knock    607215 0      31.3  -30.3 3 https://cdn.freesound.org/previews/607/607215_541139-hq.ogg
#        863784 https://cdn.freesound.org/previews/863/863784_17110092-hq.ogg Temple Blocks (5pcs), one strike per block
cafe     404478 5      55    -18.7 3 https://cdn.freesound.org/previews/404/404478_5200244-hq.ogg
#        370973 https://cdn.freesound.org/previews/370/370973_5835751-hq.ogg coffee shop ambience (mono)
#        125247 https://cdn.freesound.org/previews/125/125247_1812576-hq.ogg CoffeeShopChatter.wav
musicbox 158206 0      33.8  -22.4 3 https://cdn.freesound.org/previews/158/158206_94105-hq.ogg
#        210799 https://cdn.freesound.org/previews/210/210799_770707-hq.ogg gentle music box (check the tune is public domain)
#        381973 https://cdn.freesound.org/previews/381/381973_926978-hq.ogg Music box lullaby (check the tune is public domain)
traffic  330427 68     90    -15.6 3 https://cdn.freesound.org/previews/330/330427_3287894-hq.ogg
#        135097 https://cdn.freesound.org/previews/135/135097_658546-hq.ogg Room Tone Office Quiet Distant Traffic.wav
#        208502 https://cdn.freesound.org/previews/208/208502_1756543-hq.ogg highway, atmo, distant.wav
'

# Prints integrated loudness (LUFS) and true peak (dBTP) of the given input.
measure() {
  ffmpeg -nostdin -hide_banner -nostats "$@" -af ebur128=peak=true -f null - 2>&1 |
    awk '/Integrated loudness:/ { s = 1 } s && $1 == "I:" { i = $2 } /True peak:/ { t = 1 } t && $1 == "Peak:" { print i, $2; exit }'
}

# Lays out 22 mokugyo strikes 1.35 s apart, then the first strike again one
# period later so the loop seam repeats exactly. Timing (±25 ms) and force
# (±15 %) vary with a fixed seed.
compose_knock() {
  local graph
  graph=$(awk 'BEGIN {
    seed = 1229; n = 22; period = 1.35
    for (i = 0; i < n; i++) {
      seed = seed * 16807 % 2147483647; at[i] = .6 + i * period + (seed / 2147483647 - .5) * .05
      seed = seed * 16807 % 2147483647; force[i] = 1 + (seed / 2147483647 - .5) * .3
    }
    at[n] = at[0] + n * period; force[n] = force[0]
    printf "[0:a]atrim=0:1.2,afade=t=out:st=0.8:d=0.4,asplit=%d", n + 1
    for (i = 0; i <= n; i++) printf "[s%d]", i
    printf ";"
    for (i = 0; i <= n; i++) printf "[s%d]volume=%.3f,adelay=%d:all=1[h%d];", i, force[i], at[i] * 1000 + .5, i
    for (i = 0; i <= n; i++) printf "[h%d]", i
    printf "amix=inputs=%d:normalize=0,atrim=0:%.2f", n + 1, n * period + 1.6
  }')
  ffmpeg -nostdin -hide_banner -loglevel error -y -i "$1" -filter_complex "$graph" -c:a pcm_s24le "$2"
}

# Levels one excerpt toward its target, allowing at most $6 dB of limiting
# above -2.5 dBFS (at 4x oversampling, so intersample peaks count too),
# encodes it, and checks the MP3 itself.
build() {
  local id=$1 source=$2 start=$3 length=$4 target=$5 cap=$6 out=$sounds_dir/$1.mp3
  local rate loud peak gain
  rate=$(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 "$source")
  rate=$(( rate > 48000 ? 48000 : rate ))
  read -r loud peak < <(measure -ss "$start" -t "$length" -i "$source")
  gain=$(awk -v t="$target" -v i="$loud" -v p="$peak" -v c="$cap" 'BEGIN {
    g = t - i; over = p + g + 2.5; if (over > c) g -= over - c; printf "%.2f", g }')
  ffmpeg -nostdin -hide_banner -loglevel error -y -ss "$start" -t "$length" -i "$source" -map_metadata -1 \
    -af "aresample=$((rate * 4)),volume=${gain}dB,alimiter=limit=0.75:level=false:latency=true,aresample=$rate" \
    -c:a libmp3lame -q:a 2 -id3v2_version 0 "$out"
  read -r loud peak < <(measure -i "$out")
  printf '%-9s %5s s  %6s LUFS (目标 %s)  峰值 %5s dBTP  增益 %6s dB\n' "$id" "$length" "$loud" "$target" "$peak" "$gain"
  if ! awk -v p="$peak" 'BEGIN { exit !(p <= -1) }'; then
    printf '%s 的峰值超过 -1 dBTP。\n' "$id" >&2
    exit 1
  fi
}

while read -r id sid start length target cap url; do
  [[ -z $id || $id == \#* ]] && continue
  source=$sounds_cache/$sid.ogg
  if [[ ! -s $source ]]; then
    curl -fsSL --retry 3 -C - -o "$source.part" "$url"
    mv "$source.part" "$source"
  fi
  if [[ $id == knock ]]; then
    compose_knock "$source" "$sounds_cache/knock.wav"
    source=$sounds_cache/knock.wav
  fi
  build "$id" "$source" "$start" "$length" "$target" "$cap"
done <<<"$sounds_table"

total=$(cat "$sounds_dir"/*.mp3 | wc -c)
printf '共 %s 个文件，%s MB。\n' "$(ls "$sounds_dir"/*.mp3 | wc -l | tr -d ' ')" "$(awk -v b="$total" 'BEGIN { printf "%.1f", b / 1048576 }')"
if (( total > 30 * 1048576 )); then
  printf '超出 30 MB 预算：缩短事件型片段，或改用 -q:a 3。\n' >&2
  exit 1
fi
```

然后运行 `chmod +x build-sounds.sh`。

- [ ] **Step 4: 运行脚本**

Run: `./build-sounds.sh`

首次运行会把约 110 MB 的试听版下载到 `${TMPDIR:-/tmp}/little-reef-sounds/`，其中雷雨一条就有 51 MB。网络慢时要十几分钟；中断后重跑会接着下载。

Expected（实测结果。用同一版本的 ffmpeg 应完全一致；换版本时响度允许相差 0.2）：

```
waves        90 s   -16.4 LUFS (目标 -15.6)  峰值  -1.9 dBTP  增益   8.50 dB
rain         60 s   -15.7 LUFS (目标 -15.7)  峰值  -2.6 dBTP  增益   4.90 dB
thunder      90 s   -18.9 LUFS (目标 -16.5)  峰值  -2.2 dBTP  增益   1.40 dB
stream       60 s   -15.3 LUFS (目标 -15.2)  峰值  -1.8 dBTP  增益  12.90 dB
bubbles      60 s   -24.8 LUFS (目标 -24.8)  峰值  -4.5 dBTP  增益  -4.70 dB
boil         60 s   -16.0 LUFS (目标 -16.0)  峰值  -2.4 dBTP  增益   9.20 dB
deepsea      60 s   -18.0 LUFS (目标 -17.3)  峰值  -2.5 dBTP  增益  15.60 dB
wind         60 s   -20.8 LUFS (目标 -17.1)  峰值  -2.4 dBTP  增益  12.60 dB
fire         60 s   -24.7 LUFS (目标 -19.0)  峰值  -2.1 dBTP  增益   4.50 dB
forest       90 s   -19.1 LUFS (目标 -19.1)  峰值  -2.5 dBTP  增益  15.60 dB
summer       60 s   -20.9 LUFS (目标 -21.0)  峰值  -8.4 dBTP  增益   6.10 dB
night        90 s   -25.9 LUFS (目标 -25.9)  峰值 -14.7 dBTP  增益   3.20 dB
desert       60 s   -17.8 LUFS (目标 -17.7)  峰值  -2.4 dBTP  增益  17.60 dB
morning      90 s   -22.7 LUFS (目标 -22.7)  峰值  -4.6 dBTP  增益   1.40 dB
clock      31.5 s   -28.7 LUFS (目标 -28.7)  峰值  -2.8 dBTP  增益  -1.90 dB
knock      31.3 s   -30.3 LUFS (目标 -30.3)  峰值 -10.2 dBTP  增益 -10.30 dB
cafe         55 s   -18.7 LUFS (目标 -18.7)  峰值  -2.7 dBTP  增益   7.30 dB
musicbox   33.8 s   -22.4 LUFS (目标 -22.4)  峰值  -4.9 dBTP  增益   6.50 dB
traffic      90 s   -16.0 LUFS (目标 -15.6)  峰值  -2.4 dBTP  增益  27.40 dB
共 19 个文件，27.0 MB。
```

如果某条报“峰值超过 -1 dBTP”，或者合计超过 30 MB，就停下来报告，不要自行修改目标响度或压限上限。

- [ ] **Step 5: 运行测试，确认通过**

Run: `CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=4GiB GOFLAGS=-p=2 go test -p 2 -parallel 2 ./...`

Expected: `ok  	little-reef`

- [ ] **Step 6: 在 `THIRD_PARTY_NOTICES.txt` 末尾追加录音出处**

先空一行，再追加：

```
Ambient recordings — Freesound (https://freesound.org)

Each recording below was dedicated to the public domain by its author
under CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/).
Attribution is not required; the sources are listed for reference.
web/sounds holds trimmed, loudness-matched, re-encoded excerpts made by
build-sounds.sh; the wooden fish track arranges one recorded strike into
a steady rhythm.

waves     "Big waves hit land.wav" by straget
          https://freesound.org/s/412308/
rain      "Rain_06.wav" by Q.K.
          https://freesound.org/s/56311/
thunder   "Rain and thunder in Thailand" by felix.blume
          https://freesound.org/s/447510/
stream    "Gentle Stream Natural Stream Sound" by BurghRecords
          https://freesound.org/s/446019/
bubbles   "aquarium filter bubbling close.flac" by kyles
          https://freesound.org/s/635477/
boil      "pot metal on hot stove water simmering1.flac" by kyles
          https://freesound.org/s/635619/
deepsea   "Underwater Ambience" by Kinoton
          https://freesound.org/s/393819/
wind      "Wind is blowing in the grass of a patagonian plain…" by felix.blume
          https://freesound.org/s/139337/
fire      "campfire in a forest at night.wav" by Duophonic
          https://freesound.org/s/248303/
forest    "wind in the trees" by deleted_user_229898
          https://freesound.org/s/150174/
summer    "AkasakaHieJinjaCicadas_4mics.wav" by markystar
          https://freesound.org/s/79086/
night     "Night Woods" by widgetstudios
          https://freesound.org/s/532301/
desert    "Wind blowing into some cactus spine… desert of Atacama (Chile)." by felix.blume
          https://freesound.org/s/156414/
morning   "Dawn Chorus Birdsong" by squashy555
          https://freesound.org/s/573080/
clock     "TicTac of a wall clock" by felix.blume
          https://freesound.org/s/170445/
knock     "Mokugyo.wav" by jonopodmore
          https://freesound.org/s/607215/
cafe      "Coffee Shop.wav" by Trainscough5407
          https://freesound.org/s/404478/
musicbox  "Music Box.wav" (Brahms' Lullaby) by Rickbrewin
          https://freesound.org/s/158206/
traffic   "Downtown LA, Little Tokyo, late night semi distant traffic.wav" by janbezouska
          https://freesound.org/s/330427/
```

- [ ] **Step 7: Commit**

```bash
git add build-sounds.sh sounds_test.go state_test.go THIRD_PARTY_NOTICES.txt web/sounds
git commit -F - <<'EOF'
feat(aquarium): embed CC0 field recordings for the ambience

Nineteen excerpts of public-domain Freesound recordings replace the
procedural tracks. build-sounds.sh trims each preview, levels it to the
loudness of the track it replaces (limiting at most 3 dB, or 6 dB for the
short splashes and crackles of stream and fire), and encodes MP3 into
web/sounds, 27 MB in all. The wooden fish arranges one recorded strike
into a steady rhythm. A test pins that every sound but pink noise has its
recording and that the set stays within 30 MB.
EOF
```

### Task 2: 播放器改用录音

**Files:**
- Modify: `web/audio.js`（整个文件改写）
- 临时文件，不提交：`$SCRATCH/harness.html`、`$SCRATCH/check_audio.py`（`SCRATCH` 是用 `mktemp -d` 建的目录）

**Interfaces:**
- Consumes: Task 1 的 `web/sounds/<id>.mp3`，以及 Task 1 列出的时间点。
- Produces:
  - `export function seam(buffer, { start = .25, loop, fade = 3 } = {})`：原地处理 `AudioBuffer`，返回 `{ loopStart, loopEnd }`（单位：秒）；循环放不下时抛错。
  - `Soundscape#load(kind)`：返回 `Promise<{ buffer, loopStart, loopEnd, random }>`；失败时以 `这段声音暂时无法播放，计时不受影响` 拒绝。
  - `Soundscape#loops`：一个 `Map`，最多两项，最近用过的排在后面。
  - `unlock`、`set`、`chime`、`dispose` 的签名和行为不变。唯一的变化：加载失败时，`set` 会先淡出当前正在播放的声音。

- [ ] **Step 1: 写验收页**

```bash
SCRATCH=$(mktemp -d) && echo "$SCRATCH"
```

`$SCRATCH/harness.html`：

```html
<!doctype html><meta charset="utf-8"><title>audio check</title>
<script type="module">
import { Soundscape, seam } from "./audio.js";
const report = (o) => console.log("RESULT " + JSON.stringify(o));
const kinds = ["waves", "rain", "bubbles", "wind", "fire", "stream", "pink", "clock", "boil", "knock", "thunder", "cafe", "musicbox", "morning", "summer", "night", "forest", "deepsea", "desert", "traffic"];
const beats = { clock: [1.0, .01], knock: [1.35, .06] };
const hints = { clock: { start: .25, loop: 30.001, fade: .15 }, knock: { start: .25, loop: 29.7, fade: .15 } };
const pause = (ms) => new Promise(r => setTimeout(r, ms));

// First-strike onsets (1 ms envelope of a high-passed signal), at least 0.5 s apart.
function strikes(x, rate) {
  const hop = Math.round(rate / 1000), env = [];
  let low = 0;
  for (let i = 0; i + hop <= x.length; i += hop) {
    let m = 0;
    for (let j = i; j < i + hop; j++) { low += .2 * (x[j] - low); m = Math.max(m, Math.abs(x[j] - low)); }
    env.push(m);
  }
  const floor = [...env].sort((a, b) => a - b)[env.length >> 1] + 1e-6, found = [];
  env.forEach((e, i) => { if (e > floor * 8 && (!found.length || i / 1000 - found.at(-1) > .5)) found.push(i / 1000); });
  return found;
}
// Intervals between strikes in the 3 s before loopEnd followed by the 3 s after loopStart.
function seamBeats(buffer, loopStart, loopEnd) {
  const x = buffer.getChannelData(0), rate = buffer.sampleRate, w = 3 * rate;
  const s = Math.round(loopStart * rate), e = Math.round(loopEnd * rate);
  const joined = new Float32Array(2 * w);
  joined.set(x.subarray(e - w, e)); joined.set(x.subarray(s, s + w), w);
  const t = strikes(joined, rate);
  return t.slice(1).map((v, i) => +(v - t[i]).toFixed(3));
}

const statuses = [];
const s = new Soundscape((message, error) => statuses.push({ message, error: !!error }));
await s.unlock();
const failures = [];
const check = (ok, what) => { if (!ok) failures.push(what); };

// 1. Every sound decodes, fits its loop, and loops without a click or a broken beat.
for (const kind of kinds) {
  try {
    const loop = await s.load(kind);
    const b = loop.buffer, rate = b.sampleRate;
    const st = Math.round(loop.loopStart * rate), en = Math.round(loop.loopEnd * rate);
    let jump = 0, typical = 0;
    for (let c = 0; c < b.numberOfChannels; c++) {
      const x = b.getChannelData(c), d = [];
      jump = Math.max(jump, Math.abs(x[en - 1] - x[st]));
      for (let i = st + 1; i < en; i += 7) d.push(Math.abs(x[i] - x[i - 1]));
      d.sort((p, q) => p - q);
      typical = Math.max(typical, d[Math.floor(d.length * .999)]);
    }
    const row = { kind, seconds: +(loop.loopEnd - loop.loopStart).toFixed(3), channels: b.numberOfChannels, jump: +jump.toFixed(4), typical: +typical.toFixed(4) };
    check(loop.loopEnd <= b.duration && loop.loopStart >= 0 && loop.loopEnd - loop.loopStart > 10, `${kind}: loop out of range`);
    check(jump <= typical, `${kind}: click at the seam`);
    if (beats[kind]) {
      row.beats = seamBeats(b, loop.loopStart, loop.loopEnd);
      const [period, slack] = beats[kind];
      check(row.beats.length >= 4 && row.beats.every(v => Math.abs(v - period) <= slack), `${kind}: beat broken at the seam`);
    }
    if (kind === "musicbox") check(loop.random === false, "musicbox: should start from the top");
    report(row);
  } catch (error) { failures.push(`${kind}: ${error.message}`); }
}

// 2. WebKit keeps the encoder's leading padding: shifted content must still loop between beats.
for (const kind of ["clock", "knock"]) {
  const raw = await s.context.decodeAudioData(await (await fetch(`sounds/${kind}.mp3`)).arrayBuffer());
  const pad = Math.round(.05 * raw.sampleRate);
  const padded = s.context.createBuffer(raw.numberOfChannels, raw.length + pad, raw.sampleRate);
  for (let c = 0; c < raw.numberOfChannels; c++) padded.getChannelData(c).set(raw.getChannelData(c), pad);
  const { loopStart, loopEnd } = seam(padded, hints[kind]);
  const got = seamBeats(padded, loopStart, loopEnd), [period, slack] = beats[kind];
  check(got.length >= 4 && got.every(v => Math.abs(v - period) <= slack), `${kind}: padding breaks the beat`);
  report({ padded: kind, beats: got });
}

// Count what playback starts and stops, and what is fetched.
let started = 0, stopped = 0, fetched = [];
const proto = AudioBufferSourceNode.prototype, start = proto.start, stop = proto.stop, realFetch = window.fetch;
proto.start = function (...args) { started++; return start.apply(this, args); };
proto.stop = function (...args) { stopped++; return stop.apply(this, args); };
window.fetch = (url, ...rest) => { fetched.push(String(url).split("/").pop()); return realFetch(url, ...rest); };

// 3. Switching quickly while recordings decode: only the last choice plays.
s.loops.clear(); started = 0;
s.set(true, "rain", .3); s.set(true, "forest", .3); await s.set(true, "cafe", .3); await pause(300);
check(started === 1 && s.current?.kind === "cafe", `rapid switching started ${started} sources, current ${s.current?.kind}`);

// 4. Turning sound off while a recording decodes keeps it silent.
await s.set(false, "cafe", .3); s.loops.clear(); started = 0;
const pending = s.set(true, "thunder", .3); await s.set(false, "thunder", .3); await pending; await pause(300);
check(started === 0 && s.current === null, `sound started after being turned off (${started})`);

// 5. Coming back to a recent sound reuses its decoded loop; only two stay cached.
s.loops.clear(); fetched = [];
await s.set(true, "waves", .3); await s.set(false, "waves", .3); await s.set(true, "waves", .3);
check(fetched.filter(f => f === "waves.mp3").length === 1, `waves fetched ${fetched.length} times`);
await s.load("rain"); await s.load("wind");
check(s.loops.size === 2 && !s.loops.has("waves"), `cache holds ${[...s.loops.keys()]}`);

// 6. A recording that cannot be decoded stops the old sound and says so.
await s.set(true, "rain", .3); stopped = 0; statuses.length = 0;
await s.set(true, "volcano", .3);
check(s.current === null && stopped === 1 && statuses.at(-1)?.message === "这段声音暂时无法播放，计时不受影响" && statuses.at(-1)?.error, `failed load: ${JSON.stringify(statuses)}`);

report({ done: true, failures });
</script>
```

`$SCRATCH/check_audio.py` 会把 `web/` 复制到临时目录并放进验收页，用本机 Chrome 无头运行，然后解析结果：

```python
# Serve a scratch copy of web/ with the harness and run it in headless Chrome.
# Usage: python3 -I check_audio.py <repo>/web
import http.server, json, os, re, shutil, socketserver, subprocess, sys, tempfile, threading

web = os.path.abspath(sys.argv[1])
root = tempfile.mkdtemp()
shutil.copytree(web, os.path.join(root, "web"))
shutil.copy(os.path.join(os.path.dirname(os.path.abspath(__file__)), "harness.html"), os.path.join(root, "web", "harness.html"))
handler = lambda *a: http.server.SimpleHTTPRequestHandler(*a, directory=os.path.join(root, "web"))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
server = socketserver.TCPServer(("127.0.0.1", 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
proc = subprocess.Popen([chrome, "--headless=new", "--disable-gpu", f"--user-data-dir={tempfile.mkdtemp()}", "--autoplay-policy=no-user-gesture-required",
                         "--enable-logging=stderr", "--v=0", f"http://127.0.0.1:{server.server_address[1]}/harness.html"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
done = None
for line in proc.stderr:
    m = re.search(r'"RESULT (.*)", source', line)
    if m:
        row = json.loads(m.group(1).encode().decode("unicode_escape").encode("latin-1").decode("utf-8"))
        print(json.dumps(row, ensure_ascii=False))
        if row.get("done"):
            done = row
            break
    elif "Uncaught" in line:
        print(line.strip()); break
proc.kill(); server.shutdown()
if not done or done["failures"]:
    print("FAIL", done and done["failures"]); sys.exit(1)
print("PASS")
```

- [ ] **Step 2: 用当前的 `audio.js` 跑验收页，确认失败**

Run: `python3 -I "$SCRATCH/check_audio.py" web`

Expected: 打印 `Uncaught SyntaxError: The requested module './audio.js' does not provide an export named 'seam'` 和 `FAIL None`，退出码为 1。

- [ ] **Step 3: 改写 `web/audio.js`**

整个文件替换为：

```js
// Ambience from the CC0 field recordings embedded in sounds/, looped seamlessly
// in memory; pink noise is synthesized. Nothing is downloaded from the internet.

// Seams that must fall between beats or where a tune ends: start and loop are
// seconds into the decoded file, fade is the crossfade length.
const seams = {
  clock: { start: .25, loop: 30.001, fade: .15 },
  knock: { start: .25, loop: 29.7, fade: .15 },
  musicbox: { start: 15.5, loop: 16.94, fade: .5, random: false },
};

// Crossfades the fade seconds after the loop into its first fade seconds, in
// place and at equal power, so playback runs from loopEnd into loopStart
// without a seam. The default start skips the encoder's leading padding.
export function seam(buffer, { start = .25, loop, fade = 3 } = {}) {
  const rate = buffer.sampleRate;
  const a = Math.round(start * rate), f = Math.round(fade * rate);
  const n = loop ? Math.round(loop * rate) : buffer.length - a - f - Math.round(.25 * rate);
  if (n <= f || a + n + f > buffer.length) throw new Error(`循环超出录音长度：${buffer.duration.toFixed(2)} 秒`);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < f; i++) {
      const angle = Math.PI / 2 * i / f;
      data[a + n + i] = data[a + n + i] * Math.cos(angle) + data[a + i] * Math.sin(angle);
    }
  }
  return { loopStart: (a + f) / rate, loopEnd: (a + n + f) / rate };
}

// Pink noise (Paul Kellet's filter) from a fixed seed: 18 s, seamed like the recordings.
function pink(context) {
  const rate = context.sampleRate, length = Math.round(rate * 18);
  const buffer = context.createBuffer(2, length, rate);
  let seed = 211;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const noise = random() * 2 - 1;
      b0 = .99886 * b0 + noise * .0555179;
      b1 = .99332 * b1 + noise * .0750759;
      b2 = .96900 * b2 + noise * .1538520;
      b3 = .86650 * b3 + noise * .3104856;
      b4 = .55000 * b4 + noise * .5329522;
      b5 = -.7616 * b5 - noise * .0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + noise * .5362) * .052;
      b6 = noise * .115926;
    }
  }
  return { buffer, random: true, ...seam(buffer, { start: 0, loop: 17.65, fade: .35 }) };
}

export class Soundscape {
  constructor(onStatus) {
    this.onStatus = onStatus;
    this.context = null;
    this.output = null;
    this.current = null;
    this.loops = new Map();
    this.sequence = 0;
    this.requested = false;
    this.sound = "waves";
    this.volume = .35;
  }

  async unlock() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error("当前系统暂不支持背景音，计时仍可正常使用。");
    if (!this.context) {
      this.context = new Audio({ latencyHint: "playback" });
      this.output = this.context.createGain();
      this.output.gain.value = .55;
      this.output.connect(this.context.destination);
      this.context.onstatechange = () => {
        if (this.requested && this.context.state !== "running") this.onStatus("声音已暂停，点击声音按钮恢复");
      };
    }
    await this.context.resume();
    if (this.context.state !== "running") throw new Error("声音未能启动，请再次点击开启声音。");
  }

  // Keeps the two most recent sounds decoded (20–35 MB each); a failed load is
  // forgotten so the next attempt fetches again.
  load(kind) {
    let loop = this.loops.get(kind);
    if (loop) this.loops.delete(kind);
    else {
      loop = kind === "pink" ? Promise.resolve().then(() => pink(this.context)) : this.decode(kind);
      loop.catch(() => { if (this.loops.get(kind) === loop) this.loops.delete(kind); });
    }
    this.loops.set(kind, loop);
    if (this.loops.size > 2) this.loops.delete(this.loops.keys().next().value);
    return loop;
  }

  async decode(kind) {
    try {
      const response = await fetch(new URL(`sounds/${kind}.mp3`, import.meta.url));
      if (!response.ok) throw new Error(response.statusText);
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      const hint = seams[kind];
      return { buffer, random: hint?.random ?? true, ...seam(buffer, hint) };
    } catch {
      throw new Error("这段声音暂时无法播放，计时不受影响");
    }
  }

  fadeOut(node) {
    if (!node || !this.context) return;
    const now = this.context.currentTime;
    node.gain.gain.cancelScheduledValues(now);
    node.gain.gain.setValueAtTime(node.gain.gain.value, now);
    node.gain.gain.linearRampToValueAtTime(0, now + .45);
    node.source.stop(now + .5);
    node.source.onended = () => { node.source.disconnect(); node.gain.disconnect(); };
  }

  async set(playing, sound, volume) {
    const seq = ++this.sequence;
    this.requested = playing;
    this.sound = sound;
    this.volume = volume;
    if (!playing) {
      this.fadeOut(this.current);
      this.current = null;
      this.onStatus("声音已关闭");
      return;
    }
    try {
      await this.unlock();
      if (seq !== this.sequence || !this.requested) return;
      if (this.current?.kind === sound) {
        this.current.gain.gain.setTargetAtTime(volume, this.context.currentTime, .08);
      } else {
        const loop = await this.load(sound);
        if (seq !== this.sequence || !this.requested) return;
        const source = this.context.createBufferSource();
        source.buffer = loop.buffer;
        source.loop = true;
        source.loopStart = loop.loopStart;
        source.loopEnd = loop.loopEnd;
        const gain = this.context.createGain();
        gain.gain.value = 0;
        source.connect(gain); gain.connect(this.output);
        // A random entry point keeps each session from opening the same way.
        source.start(0, loop.loopStart + (loop.random ? Math.random() * (loop.loopEnd - loop.loopStart) : 0));
        gain.gain.linearRampToValueAtTime(volume, this.context.currentTime + .6);
        this.fadeOut(this.current);
        this.current = { source, gain, kind: sound };
      }
      this.onStatus({ waves: "海浪正轻轻陪着你", rain: "窗外仿佛下着细雨", bubbles: "像在安静的水族箱旁", wind: "风从远处轻轻吹来", fire: "篝火噼啪，安静又暖", stream: "溪水在不远处流过", pink: "平稳的底噪替你盖住杂音", clock: "滴答之间，时间在走", boil: "水在咕嘟，慢慢开着", knock: "一声一声，稳稳地", thunder: "远处有雷，雨声更重了", cafe: "像坐在安静的咖啡馆角落", musicbox: "一段很慢的小旋律", morning: "清晨的风和鸟鸣", summer: "蝉鸣阵阵，夏天正盛", night: "夏夜虫鸣，风也安静", forest: "林子里，风穿过树叶", deepsea: "很深很深的海底", desert: "风卷细沙，安静辽阔", traffic: "远处有车流经过" }[sound]);
    } catch (error) {
      if (seq !== this.sequence) return;
      // Stop the previous sound too: it no longer matches the selection.
      this.fadeOut(this.current);
      this.current = null;
      this.onStatus(error.message, true);
    }
  }

  chime() {
    if (!this.context || this.context.state !== "running") return;
    for (const [i, frequency] of [523.25, 659.25, 783.99].entries()) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const start = this.context.currentTime + i * .16;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.07, start + .025);
      gain.gain.exponentialRampToValueAtTime(.001, start + .6);
      oscillator.connect(gain); gain.connect(this.context.destination);
      oscillator.start(start); oscillator.stop(start + .65);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  }

  dispose() { this.sequence++; this.requested = false; this.context?.close(); }
}
```

- [ ] **Step 4: 跑验收页，确认通过**

Run: `python3 -I "$SCRATCH/check_audio.py" web`

Expected（实测）：每种声音输出一行结果，共 20 行，每行的 `jump` 都不大于 `typical`。例如：

```
{"kind": "clock", "seconds": 30.001, "channels": 1, "jump": 0.0002, "typical": 0.1335, "beats": [1.003, 0.998, 1.002, 1.001, 0.994]}
{"kind": "knock", "seconds": 29.7, "channels": 2, "jump": 0, "typical": 0.0349, "beats": [1.33, 1.342, 1.382, 1.355]}
{"kind": "musicbox", "seconds": 16.94, "channels": 2, "jump": 0.0015, "typical": 0.1887}
{"padded": "clock", "beats": [1.003, 0.998, 1.002, 1.001, 0.994]}
{"padded": "knock", "beats": [1.33, 1.342, 1.382, 1.355]}
{"done": true, "failures": []}
PASS
```

- [ ] **Step 5: 在浏览器模式下冒烟测试**

```bash
DATA=$(mktemp -d)
CGO_ENABLED=0 go run . -web 127.0.0.1:4173 -data-dir "$DATA" > "$SCRATCH/app.log" 2>&1 &
for i in $(seq 1 90); do curl -s -o /dev/null http://127.0.0.1:4173/ && break; python3 -c "import time; time.sleep(1)"; done
curl -s -o /dev/null -w "page %{http_code}\n" http://127.0.0.1:4173/
curl -s -o /dev/null -w "rain.mp3 %{http_code} %{content_type}\n" http://127.0.0.1:4173/sounds/rain.mp3
python3 -I - <<'EOF'
import subprocess, tempfile
chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
p = subprocess.Popen([chrome, "--headless=new", "--disable-gpu", f"--user-data-dir={tempfile.mkdtemp()}", "--enable-logging=stderr", "--v=0",
                      "http://127.0.0.1:4173/"], stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True)
try:
    _, err = p.communicate(timeout=12)
except subprocess.TimeoutExpired:
    p.kill(); _, err = p.communicate()
print("\n".join(l for l in err.splitlines() if "CONSOLE" in l or "Uncaught" in l) or "no console errors")
EOF
pkill -f -- "-web 127.0.0.1:4173"
```

Expected：`page 200`、`rain.mp3 200 audio/mpeg`、`no console errors`。

- [ ] **Step 6: Commit**

```bash
git add web/audio.js
git commit -F - <<'EOF'
feat(aquarium): play the embedded recordings in seamless loops

The player fetches and decodes a sound's MP3 when it is chosen, crossfades
the loop seam in place at equal power, and loops natively, so nothing
depends on timers while the window sits in the tray. Clock and wooden fish
seams fall between strikes, and the music box joins where its tune ends
and starts from the top; other sounds enter at a random point. The two
most recent sounds stay decoded. A recording that fails to load stops the
previous sound and says so. Pink noise is still synthesized.
EOF
```

### Task 3: 文档与整体验证

**Files:**
- Modify: `README.md:3`、`README.md:32`、`README.md:58`、`README.md:66`

- [ ] **Step 1: 更新 README**

第 3 行替换为：

```markdown
用专注时间养出一片小海底。Go 后端管理计时和存档，网页界面绘制水族馆，背景音是随程序打包的公共领域实地录音。前端和录音都已嵌入 Go 程序，不需要 Bun 或前端构建，播放时也不联网。
```

第 32 行在“WebKitGTK 4.1（或 4.0）。”之后插入：

```markdown
Linux 播放背景音还需要 GStreamer 的 MP3 解码插件（gst-plugins-good 1.18 或更高版本）。
```

第 58 行（“背景音说明”下面的那一段）替换为两段：

```markdown
除粉噪外，19 种背景音都是 Freesound 上以 CC0（公共领域）发布的实地录音，出处见 [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt)。`build-sounds.sh` 从高码率试听版截取 30 到 90 秒的片段，把响度对齐到原先合成声音的水平（需要压限太多时宁可轻一些），在 4 倍过采样下限幅，再编码为 MP3 写入 `web/sounds`，合计约 27 MB。木鱼由一次真实敲击排成稳定的节奏。更换录音时，修改脚本里的表格后重新运行即可，需要 ffmpeg 和网络；平时构建和运行都不需要它。

播放时先解码录音，在内存里把首尾交叉淡化，再交给 Web Audio 原生循环，窗口收进托盘也不会断。时钟和木鱼的接缝落在两次敲击之间；音乐盒在曲尾衔接，并从曲头开始播放；其余声音每次从随机位置开始。最近用过的两种声音会留在内存里。粉噪仍由固定种子实时合成。首次不自动播放；保存声音类型、音量与专注播放开关，重启不会自动出声。系统不支持 Web Audio、播放受限或录音无法解码时提示用户，计时继续工作。
```

第 66 行替换为：

```markdown
测试覆盖暂停恢复的实际时间、提前结束、完成仅结算一次、访客存档、休眠暂停、恢复设置、休息不奖励成长、保存失败回滚，以及每种录音都已打包且合计不超过 30 MB。
```

- [ ] **Step 2: 全量测试与静态检查**

Run: `CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=4GiB GOFLAGS=-p=2 go test -p 2 -parallel 2 ./... && CGO_ENABLED=0 go vet ./...`

Expected: `ok  	little-reef`；`go vet` 没有输出。

- [ ] **Step 3: 确认脚本可复现**

Run: `./build-sounds.sh > /dev/null && git status --short web/sounds`

Expected: 没有输出。重跑产出的文件逐字节相同；试听版已缓存，约 20 秒跑完。

- [ ] **Step 4: 确认程序体积**

Run: `CGO_ENABLED=0 go build -o "$SCRATCH/little-reef" . && ls -l "$SCRATCH/little-reef"`

Expected: 约 41.9 MB（改动前是 14.7 MB）。

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -F - <<'EOF'
docs(aquarium): describe the recorded ambience

The README now says where the recordings come from, how build-sounds.sh
levels and encodes them, how they loop, and that Linux needs GStreamer's
MP3 decoder to play them.
EOF
```

- [ ] **Step 6: 交给用户试听**

启动桌面版：`CGO_ENABLED=0 go run .`（也可以用浏览器版：`go run . -web 127.0.0.1:4173`）。请用户把 20 种声音逐个点一遍，重点听：
- 接缝处有没有跳动：时钟和木鱼约每 30 秒一次，其余声音每 50–90 秒一次；
- 换声音时音量是否忽大忽小：风声、篝火比原来轻 4–6 LU；
- 音乐盒是否从曲头开始。

记下用户点名要换的声音和原因。

### 试听后更换录音（按需）

用户点名某种声音不满意时：

1. 在 `build-sounds.sh` 里，把这种声音那一行的 Freesound 编号和试听版地址换成某个备选行的值；在 `THIRD_PARTY_NOTICES.txt` 里，把对应条目换成备选录音的标题、作者和链接。
2. 选截取位置：用下面的命令按秒列出短期响度（第一列是秒数，第二列是 LUFS；开头 3 秒显示 −120.7 属正常）。挑一段没有突兀尖峰、长度与原行相同的片段，把起点和时长填进表格。

   ```bash
   ffmpeg -nostdin -loglevel verbose -i "${TMPDIR:-/tmp}/little-reef-sounds/<编号>.ogg" -af ebur128 -f null - 2>&1 |
     sed -nE 's/.* t: *([0-9.]+) .* S: *(-?[0-9.]+) .*/\1 \2/p' | awk 'NR % 10 == 0'
   ```

   试听版要先下载到这个缓存目录，下载地址见表格里的备选行；也可以先运行一次脚本，让它自动下载。
3. 时钟、木鱼和音乐盒的备选还需要重新测量周期和接缝位置，并同步更新 `web/audio.js` 里的 `seams`；其余声音不用改代码。
4. 重新运行 `./build-sounds.sh`、Task 2 的验收页和 Go 测试，然后提交，提交信息写 `fix(aquarium): swap the <sound> recording`。
