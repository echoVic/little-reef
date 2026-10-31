import { test, expect, afterEach } from "vitest";
import { speciesColors, maxCreatures } from "../src/reef/species";

afterEach(() => {
  delete (globalThis as { THEME?: unknown }).THEME;
});

test("species palette falls back to per-species colors without a theme", () => {
  expect(speciesColors("resident")?.back).toBe("#df7a3e");
  expect(speciesColors("clown")?.back).toBe("#dc6624");
});

test("creaturePalette recolors fish bodies to the theme fish token", () => {
  (globalThis as { THEME?: unknown }).THEME = { creaturePalette: { fish: "#2E6BA0" } };
  expect(speciesColors("clown")?.back).toBe("#2E6BA0");
  expect(speciesColors("clown")?.back).not.toBe("#dc6624");
});

test("maxCreatures honors theme behavior tokens", () => {
  expect(maxCreatures()).toBe(999);
  (globalThis as { THEME?: unknown }).THEME = { behavior: { maxCreatures: 3 } };
  expect(maxCreatures()).toBe(3);
});
