import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const themesDir = fileURLToPath(new URL('../web/themes', import.meta.url));

// Integration test through the REAL applyTheme → loadTheme merge path
// (fetch mocked from disk), not a hand-built THEME object: this is what
// catches fields the merge forgot to carry forward.
globalThis.fetch = async (url) => {
  const id = url.match(/themes\/([\w-]+)\/theme\.json/)[1];
  return { ok: true, json: async () => JSON.parse(readFileSync(`${themesDir}/${id}/theme.json`, 'utf8')) };
};
globalThis.document = { documentElement: { style: { setProperty: () => {} } } };
globalThis.window = { dispatchEvent: () => {} };

test('applyTheme merges behavior and creaturePalette into THEME', async () => {
  const { applyTheme } = await import('../web/theme.js');
  await applyTheme('cm-ink');
  assert.equal(globalThis.THEME.behavior.maxCreatures, 2, 'cm-ink cap must survive the merge');
  assert.equal(globalThis.THEME.creaturePalette.fish, '#7FB2D6');
  // fallback inheritance: motion keys come from the merged base too
  assert.ok(globalThis.THEME.motion.bubbleDensity <= 1.0);
  await applyTheme('reef-realistic');
  assert.equal(globalThis.THEME.creaturePalette, undefined, 'realistic ships no palette → species stay true');
});
