#!/bin/bash
# Package a locally signed demo on macOS or seal a cross-built demo with rcodesign.
# Ad-hoc signing is not Developer ID signing or Apple notarization.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  printf '用法：package-macos.sh <小海底.app> <输出.zip>\n' >&2
  exit 2
fi

aquarium_source=$1
aquarium_output=$2
if [[ ! -d "$aquarium_source/Contents/MacOS" ]]; then
  printf '找不到小海底应用包。\n' >&2
  exit 1
fi
if [[ -e "$aquarium_output" ]]; then
  printf '输出文件已存在，请选择新的文件名。\n' >&2
  exit 1
fi

aquarium_stage=$(mktemp -d)
trap 'rm -rf "$aquarium_stage"' EXIT
cp -R "$aquarium_source" "$aquarium_stage/小海底.app"
chmod 755 "$aquarium_stage/小海底.app/Contents/MacOS/小海底"

if [[ $(uname -s) == Darwin ]]; then
  /usr/bin/codesign --force --sign - "$aquarium_stage/小海底.app"
  /usr/bin/codesign --verify --deep --strict "$aquarium_stage/小海底.app"
else
  if ! command -v rcodesign >/dev/null 2>&1; then
    printf '跨平台封装需要 rcodesign；不能把仅有链接器签名的应用直接作为 Mac 下载包。\n' >&2
    exit 1
  fi
  rcodesign --config-file /dev/null sign --timestamp-url none "$aquarium_stage/小海底.app"
fi

cp "$(dirname "$0")/启动小海底.command" "$aquarium_stage/启动小海底.command"
chmod 755 "$aquarium_stage/启动小海底.command"
cp "$(dirname "$0")/Mac打开说明.txt" "$aquarium_stage/Mac打开说明.txt"

mkdir -p "$(dirname "$aquarium_output")"
if [[ $(uname -s) == Darwin ]]; then
  /usr/bin/ditto -c -k "$aquarium_stage" "$aquarium_output"
else
  python3 - "$aquarium_stage" "$aquarium_output" <<'PY'
import pathlib
import sys
import zipfile

root = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2], "x", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob("*")):
        archive.write(path, path.relative_to(root))
PY
fi
printf 'Mac 下载包已生成。临时签名版本首次使用请双击“启动小海底.command”。\n'
