import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../web', import.meta.url));
const html = readFileSync(`${root}/index.html`, 'utf8');
const app = readFileSync(`${root}/app.js`, 'utf8');

test('settings dialog ships a theme picker inside the form', () => {
  assert.match(html, /id="theme-list"[^>]*role="radiogroup"/, 'missing radiogroup container');
  assert.match(html, /海底皮肤/, 'missing picker title');
});

test('picker renders from backend list and switches via SetTheme RPC', () => {
  assert.match(app, /call\("Aquarium\.GetThemes"\)/, 'list not fetched from backend');
  assert.match(app, /call\("Aquarium\.SetTheme", t\.id\)/, 'click does not call SetTheme');
  assert.match(app, /aria-checked/, 'no checked state for current theme');
});
