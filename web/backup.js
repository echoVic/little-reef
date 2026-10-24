// backup.js — 备份与恢复入口的文案与浏览器模式兜底下载。
// Desktop 模式走 mygo.Dialog（Go 侧完成落盘/读取），浏览器模式退化为
// 文本下载 + file input，二者共用这里的文案。

export function exportToast(fileName) {
  return `存档已保存到 ${fileName}，收好它，随时可以恢复。`;
}

export const importConfirm = "导入会替换现在的海底。建议先导出一份当前存档。";

export const importSuccess = "海底回来了，一切如初。";

// Browser-mode export: hand the JSON text to the user as a downloaded file.
export function downloadArchive(fileName, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
