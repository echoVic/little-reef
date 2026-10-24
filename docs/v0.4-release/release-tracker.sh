#!/bin/sh
# release-tracker.sh — v0.4 发布周表（用户自行运行，不自动执行）
# 口径：GitHub 公开计数（releases 资产下载量 / issues 标签计数 / star 数），无任何遥测。
# 基线（2026-10-24）：DMG 合计 5、update json 6、star 2、issue 0。
# 用法：sh docs/v0.4-release/release-tracker.sh
# 输出：追加打印一行周表（日期 | DMG 下载 | update json 拉取 | star | issue 总数 | 分标签计数）。

REPO="echoVic/little-reef"
API="https://api.github.com/repos/$REPO"

echo "== $(date +%F) =="

# Release assets: DMG 与 update-darwin-arm64.json 的 download_count。
curl -sf "$API/releases" | python3 - <<'PY'
import json, sys
try:
    releases = json.load(sys.stdin)
except Exception as e:
    print("releases 拉取失败：", e); sys.exit(1)
dmg, updater = 0, 0
for r in releases:
    for a in r.get("assets", []):
        n = a.get("name", "")
        c = a.get("download_count", 0)
        if n.endswith(".dmg"):
            dmg += c
        if "update" in n and n.endswith(".json"):
            updater += c
print(f"DMG 下载合计: {dmg}")
print(f"update json 拉取合计: {updater}")
PY

# Star 数。
curl -sf "$API" | python3 -c "import json,sys; d=json.load(sys.stdin); print('star:', d.get('stargazers_count'))"

# Issues 按标签计数。
curl -sf "$API/issues?state=all&per_page=100" | python3 - <<'PY'
import json, sys
try:
    issues = json.load(sys.stdin)
except Exception as e:
    print("issues 拉取失败：", e); sys.exit(1)
counts = {}
real = 0
for i in issues:
    if "pull_request" in i:  # PR 也会出现在 issues 接口里，排除
        continue
    real += 1
    for l in i.get("labels", []):
        name = l.get("name") if isinstance(l, dict) else l
        counts[name] = counts.get(name, 0) + 1
print("issue 总数:", real)
for tag in ["bug", "sound", "growth", "stats", "backup", "other"]:
    print(f"  {tag}: {counts.get(tag, 0)}")
PY
