import { test, expect, vi } from "vitest";
import { exportToast, importConfirm, importSuccess, downloadArchive } from "../src/backup/backup";

test("export success copy carries the file name", () => {
  expect(exportToast("little-reef-archive.json")).toBe("存档已保存到 little-reef-archive.json，收好它，随时可以恢复。");
  expect(exportToast("小海底-2026.json")).toBe("存档已保存到 小海底-2026.json，收好它，随时可以恢复。");
});

test("import confirmation and success copy stay gentle", () => {
  expect(importConfirm).toBe("导入会替换现在的海底。建议先导出一份当前存档。");
  expect(importSuccess).toBe("海底回来了，一切如初。");
});

test("browser export downloads the JSON text as a blob anchor", () => {
  const created: { type: string; parts: string[] }[] = [];
  const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
  vi.stubGlobal("URL", {
    createObjectURL: (blob: { type: string; parts: string[] }) => { created.push(blob); return "blob:fake"; },
    revokeObjectURL: (url: string) => expect(url).toBe("blob:fake"),
  });
  const appendChild = vi.fn();
  vi.spyOn(document, "createElement").mockReturnValue(link as unknown as HTMLAnchorElement);
  vi.spyOn(document.body, "appendChild").mockImplementation(appendChild);
  vi.stubGlobal("Blob", class { type: string; parts: string[]; constructor(parts: string[], options: { type: string }) { this.parts = parts; this.type = options.type; } });

  downloadArchive("little-reef-archive.json", '{"version":1}');
  expect(link.download).toBe("little-reef-archive.json");
  expect(link.href).toBe("blob:fake");
  expect(created).toHaveLength(1);
  expect(created[0].type).toBe("application/json");
  expect(created[0].parts).toEqual(['{"version":1}']);
  expect(link.click).toHaveBeenCalled();
  expect(link.remove).toHaveBeenCalled();
  vi.unstubAllGlobals();
});
