import test from 'node:test';
import assert from 'node:assert/strict';
import { exportToast, importConfirm, importSuccess, downloadArchive } from '../web/backup.js';

test('export success copy carries the file name', () => {
  assert.equal(exportToast('little-reef-archive.json'), '存档已保存到 little-reef-archive.json，收好它，随时可以恢复。');
  assert.equal(exportToast('小海底-2026.json'), '存档已保存到 小海底-2026.json，收好它，随时可以恢复。');
});

test('import confirmation and success copy stay gentle', () => {
  assert.equal(importConfirm, '导入会替换现在的海底。建议先导出一份当前存档。');
  assert.equal(importSuccess, '海底回来了，一切如初。');
});

test('browser export downloads the JSON text', () => {
  const created = [];
  const link = { click() {}, remove() {}, set href(v) { this._href = v; }, get href() { return this._href; }, set download(v) { this._name = v; }, get download() { return this._name; } };
  globalThis.URL = {
    createObjectURL: blob => { created.push(blob); return 'blob:fake'; },
    revokeObjectURL: url => assert.equal(url, 'blob:fake'),
  };
  globalThis.document = {
    body: { appendChild(el) { assert.equal(el, link); } },
    createElement: tag => { assert.equal(tag, 'a'); return link; },
  };
  globalThis.Blob = class {
    constructor(parts, options) { this.parts = parts; this.type = options.type; }
  };
  downloadArchive('little-reef-archive.json', '{"version":1}');
  assert.equal(link._name, 'little-reef-archive.json');
  assert.equal(link._href, 'blob:fake');
  assert.equal(created.length, 1);
  assert.equal(created[0].type, 'application/json');
  assert.deepEqual(created[0].parts, ['{"version":1}']);
});
