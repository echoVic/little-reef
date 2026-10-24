# v0.4 发布物料（docs/v0.4-release/）

本目录是 v0.4（回顾面板 + 存档备份）的发布物料定稿落盘。文案来源：飞书 docx/OQ8Qd9SaHokTnUxW7zCcSSIbncf（revision 5，2026-10-24 定稿）。

## 文件清单

| 文件 | 用途 | 发布动作（均待用户确认） |
|-|-|-|
| `website-copy.md` | 官网 reef.echovic.com 中英对照全文（含新增 005 屏） | 官网仓库位置待用户告知，本仓库不部署 |
| `channel-posts.md` | HN / Product Hunt / V2EX / 即刻 / 少数派 / 小红书 六渠道成稿 | 按 Q7 节奏逐渠道发布，逐条等确认 |
| `issue-template.yml` | GitHub Issue 反馈模板 YAML（原文保真） | 已同步到 `.github/ISSUE_TEMPLATE/feedback.yml`，随代码进仓库即生效 |
| `release-notes.md` | CHANGELOG 0.4.0 条目 + GitHub Release 正文 + 六标签清单 + 护栏审查记录 | CHANGELOG 条目本轮写入仓库；Release tag 与正文发布待确认 |
| `video-storyboard.md` | 30–45s 演示视频 6 镜分镜定稿 + 真机录制指引 | 初剪版见仓库外交付物；公开发布待确认 |
| `release-tracker.sh` | 周表脚本（下载量 / update json 拉取量 / star / issue 标签计数） | **用户自行运行，不自动执行** |

## 发布边界

- 本目录只落物料；任何对外动作（打 tag、发 Release、官网部署、发帖、投稿、视频发布）**逐项等用户确认**。
- GitHub 六标签（bug/sound/growth/stats/backup/other，颜色见 release-notes.md）需仓库管理权限，手动创建指引见 release-notes.md。
- 周表口径：每周一次拉 GitHub 公开计数（releases 资产 download_count、issues 标签计数、star 数），基线（2026-10-24）：DMG 合计 5、update json 6、star 2、issue 0。不入库任何遥测性质数据。
- 官网部署需要官网仓库位置（用户待提供）。
