#!/bin/bash
# Locally seal and open this specific user-downloaded demo.
# Do not disable Gatekeeper or alter quarantine on any other path.
set -euo pipefail

aquarium_folder=$(cd "$(dirname "$0")" && pwd -P)
aquarium_app="$aquarium_folder/小海底.app"
aquarium_executable="$aquarium_app/Contents/MacOS/小海底"

fail() {
  printf '\n小海底没有打开：%s\n' "$1" >&2
  /usr/bin/osascript -e 'display alert "小海底没有打开" message "请保持启动文件与小海底.app在同一个解压文件夹内。若仍失败，请把窗口中的错误信息反馈回来。" as critical' || true
  exit 1
}
trap 'fail "本地签名或打开失败，请保留上方错误信息。"' ERR

if [[ $(uname -s) != Darwin ]]; then
  printf '此启动文件仅适用于 Mac。\n' >&2
  exit 1
fi
[[ -d "$aquarium_app" && ! -L "$aquarium_app" ]] || fail "找不到同目录的小海底.app。"
[[ -f "$aquarium_executable" && ! -L "$aquarium_executable" ]] || fail "应用缺少可执行文件。"
aquarium_identifier=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$aquarium_app/Contents/Info.plist")
[[ "$aquarium_identifier" == dev.mygo.examples.aquarium ]] || fail "这不是此下载包中的小海底应用。"

printf '正在为小海底完成本机签名。无需密码，不修改全局安全设置。\n'
/bin/chmod u+x "$aquarium_executable"
/usr/bin/codesign --force --sign - "$aquarium_app"
/usr/bin/codesign --verify --deep --strict "$aquarium_app"
# Remove only this downloaded demo's quarantine after a successful local seal.
/usr/bin/xattr -dr com.apple.quarantine "$aquarium_app"
/usr/bin/open "$aquarium_app"
printf '\n小海底已启动，可以关闭这个窗口。\n'
