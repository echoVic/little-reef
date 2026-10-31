import { test, beforeEach, afterEach } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const themesDir = join(process.cwd(), "public", "themes");

// Integration test through the REAL applyTheme → loadTheme merge path
// (fetch mocked from disk), not a hand-built THEME object.
let originalFetch: typeof globalThis.fetch | undefined;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: unknown) => {
    const id = String(url).match(/themes\/([\w-]+)\/theme\.json/)?.[1];
    return { ok: true, json: async () => JSON.parse(readFileSync(`${themesDir}/${id}/theme.json`, "utf8")) } as Response;
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch as typeof globalThis.fetch;
});

test("applyTheme merges behavior and creaturePalette into THEME", async () => {
  const { applyTheme } = await import("./theme");
  const G = globalThis as unknown as { THEME: Record<string, any> };
  await applyTheme("cm-ink");
  assert.equal(G.THEME.behavior.maxCreatures, 2, "cm-ink cap must survive the merge");
  assert.equal(G.THEME.creaturePalette.fish, "#7FB2D6");
  assert.ok(G.THEME.motion.bubbleDensity <= 1.0);
  await applyTheme("reef-realistic");
  assert.equal(G.THEME.creaturePalette, undefined, "realistic ships no palette → species stay true");
});
