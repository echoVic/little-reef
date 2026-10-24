import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const themesDir = fileURLToPath(new URL('../web/themes', import.meta.url));
const ids = readdirSync(themesDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);

test('exactly the ten contracted theme packages exist', () => {
  assert.deepEqual([...ids].sort(), [
    'cm-cel', 'cm-ink', 'cm-pop', 'cn-qinghua', 'cn-qinglu', 'cn-shuimo',
    'ct-cream', 'ct-jelly', 'ct-strawberry', 'reef-realistic',
  ]);
});

for (const id of ids) {
  test(`${id}: schema fields complete and gates hold`, () => {
    const t = JSON.parse(readFileSync(`${themesDir}/${id}/theme.json`, 'utf8'));
    // 16 token skeleton
    for (const token of ['bgBase','bgGradient','waterLight','sand','coral','fish','seaweed','bubble',
      'accent','timerActive','timerPause','controlBg','controlBorder','textPrimary','textSecondary','menuIcon']) {
      assert.ok(t.tokens[token] !== undefined, `missing token ${token}`);
    }
    // meta
    for (const field of ['themeId','displayName','styleFamily','version','minAppVersion','supportsDarkAppearance','reduceMotionFallback']) {
      assert.ok(t.meta[field] !== undefined, `missing meta.${field}`);
    }
    assert.equal(t.meta.themeId, id);
    if (id !== 'reef-realistic') assert.equal(t.meta.supportsDarkAppearance, false);
    // motion gates
    assert.ok(t.motion.bubbleDensity <= 1.0, `bubbleDensity ${t.motion.bubbleDensity} > 1.0`);
    assert.ok(t.motion.driftSpeed <= 1.0, `driftSpeed ${t.motion.driftSpeed} > 1.0`);
    // audio gates
    assert.equal(t.ambientAudio.defaultOn, false);
    assert.ok(t.ambientAudio.maxVolume <= 0.2);
    // controls + fonts contract
    assert.ok(t.controls.radius, `${id} missing controls.radius`);
    for (const f of ['title', 'body', 'digits']) assert.ok(t.fonts[f] !== undefined, `${id} missing fonts.${f}`);
    // behavior cap
    assert.ok(Number.isInteger(t.behavior.maxCreatures) && t.behavior.maxCreatures > 0);
  });
}

test('species palette falls back to per-species colors without a theme', async () => {
  const { speciesColors } = await import('../web/creatures/species.js');
  delete globalThis.THEME;
  assert.equal(speciesColors('resident').back, '#df7a3e');
  assert.equal(speciesColors('clown').back, '#dc6624');
});

test('creaturePalette recolors fish bodies to the theme fish token', async () => {
  const { speciesColors } = await import('../web/creatures/species.js');
  globalThis.THEME = { creaturePalette: { fish: '#2E6BA0' } };
  const c = speciesColors('clown');
  assert.equal(c.back, '#2E6BA0');
  assert.notEqual(c.back, '#dc6624');
  delete globalThis.THEME;
});

test('maxCreatures honors theme behavior tokens', async () => {
  const { maxCreatures } = await import('../web/creatures/species.js');
  delete globalThis.THEME;
  assert.equal(maxCreatures(), 999);
  globalThis.THEME = { behavior: { maxCreatures: 3 } };
  assert.equal(maxCreatures(), 3);
  delete globalThis.THEME;
});
