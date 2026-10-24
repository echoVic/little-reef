import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The default theme is a pure extraction of what was hard-coded before the
// theme system existed: every token here must equal the value the UI already
// shipped with, so adopting it changes nothing on screen.
const theme = JSON.parse(readFileSync(new URL('../web/themes/reef-realistic/theme.json', import.meta.url), 'utf8'));

test('the 16-token skeleton is complete', () => {
  const { tokens } = theme;
  for (const token of [
    'bgBase', 'bgGradient', 'waterLight', 'sand',
    'coral', 'fish', 'seaweed', 'bubble',
    'accent', 'timerActive', 'timerPause', 'controlBg',
    'controlBorder', 'textPrimary', 'textSecondary', 'menuIcon',
  ]) {
    assert.ok(tokens[token] !== undefined, `missing token ${token}`);
  }
});

test('reef-realistic tokens equal the shipped hard-coded colors', () => {
  const { tokens } = theme;
  assert.equal(tokens.bgBase, '#0c1820');
  assert.equal(tokens.bgGradient, '#102e3a');
  assert.equal(tokens.waterLight, '#194250');
  assert.equal(tokens.controlBg, '#12232b');
  assert.equal(tokens.controlBorder, '#254047');
  assert.equal(tokens.textPrimary, '#e3ede9');
  assert.equal(tokens.textSecondary, '#8ca7a7');
  assert.equal(tokens.accent, '#a8deba');
  assert.equal(tokens.coral.color, '#bd918c');
  assert.equal(tokens.seaweed.color, '#529a86');
});

test('creature tokens carry growth stages aligned with the coral growth', () => {
  assert.equal(theme.tokens.coral.stages, 3);
  assert.equal(theme.tokens.seaweed.stages, 3);
});

test('motion gates stay at the baseline 1.0x', () => {
  assert.ok(theme.motion.bubbleDensity <= 1.0);
  assert.ok(theme.motion.driftSpeed <= 1.0);
});

test('ambient audio never defaults on and stays quiet', () => {
  assert.equal(theme.ambientAudio.defaultOn, false);
  assert.ok(theme.ambientAudio.maxVolume <= 0.2);
});

test('meta describes the dark default contract', () => {
  assert.equal(theme.meta.themeId, 'reef-realistic');
  assert.equal(theme.meta.supportsDarkAppearance, true);
  for (const field of ['displayName', 'styleFamily', 'version', 'minAppVersion', 'reduceMotionFallback']) {
    assert.ok(theme.meta[field], `missing meta.${field}`);
  }
});

test('themeColor falls back to the shipped literal without a loaded theme', async () => {
  const { themeColor } = await import('../web/theme.js');
  delete globalThis.THEME;
  assert.equal(themeColor('bubble', '#b4cfb1'), '#b4cfb1');
});

test('themeColor reads the live token instead of the constant', async () => {
  const { themeColor, themeMotion } = await import('../web/theme.js');
  globalThis.THEME = { tokens: { bubble: '#ffffff', coral: { color: '#ff0000', stages: 3 } }, motion: { bubbleDensity: 0.2 } };
  assert.equal(themeColor('bubble', '#b4cfb1'), '#ffffff');
  assert.equal(themeColor('coral', '#bd918c'), '#ff0000');
  assert.equal(themeMotion('bubbleDensity'), 0.2);
  delete globalThis.THEME;
});
