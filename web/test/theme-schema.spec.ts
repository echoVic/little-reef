import { test } from "vitest";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const themesDir = join(process.cwd(), "public", "themes");
const ids = readdirSync(themesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

test("exactly the ten contracted theme packages exist", () => {
  assert.deepEqual([...ids].sort(), [
    "cm-cel", "cm-ink", "cm-pop", "cn-qinghua", "cn-qinglu", "cn-shuimo",
    "ct-cream", "ct-jelly", "ct-strawberry", "reef-realistic",
  ]);
});

for (const id of ids) {
  test(`${id}: schema fields complete and gates hold`, () => {
    const t = JSON.parse(readFileSync(`${themesDir}/${id}/theme.json`, "utf8"));
    for (const token of ["bgBase", "bgGradient", "waterLight", "sand", "coral", "fish", "seaweed", "bubble",
      "accent", "timerActive", "timerPause", "controlBg", "controlBorder", "textPrimary", "textSecondary", "menuIcon"]) {
      assert.ok(t.tokens[token] !== undefined, `missing token ${token}`);
    }
    for (const field of ["themeId", "displayName", "styleFamily", "version", "minAppVersion", "supportsDarkAppearance", "reduceMotionFallback"]) {
      assert.ok(t.meta[field] !== undefined, `missing meta.${field}`);
    }
    assert.equal(t.meta.themeId, id);
    if (id !== "reef-realistic") assert.equal(t.meta.supportsDarkAppearance, false);
    assert.ok(t.motion.bubbleDensity <= 1.0, `bubbleDensity ${t.motion.bubbleDensity} > 1.0`);
    assert.ok(t.motion.driftSpeed <= 1.0, `driftSpeed ${t.motion.driftSpeed} > 1.0`);
    assert.equal(t.ambientAudio.defaultOn, false);
    assert.ok(t.ambientAudio.maxVolume <= 0.2);
    assert.ok(t.controls.radius, `${id} missing controls.radius`);
    for (const f of ["title", "body", "digits"]) assert.ok(t.fonts[f] !== undefined, `${id} missing fonts.${f}`);
    assert.ok(Number.isInteger(t.behavior.maxCreatures) && t.behavior.maxCreatures > 0);
  });
}
