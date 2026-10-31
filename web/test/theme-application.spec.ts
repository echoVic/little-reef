import { test, expect, vi, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { applyTheme } from "../src/theme/theme";

// Lock the single source of truth: theme JSON -> VAR_MAP -> :root CSS vars.
// Every theme must resolve the full UI token set; reef-realistic must keep its
// original locked defaults. No token should silently inherit the wrong scope.
const THEMES = ["cm-cel","cm-ink","cm-pop","cn-qinghua","cn-qinglu","cn-shuimo","ct-cream","ct-jelly","ct-strawberry","reef-realistic"];
const themesDir = path.resolve(__dirname, "../public/themes");

// token key -> CSS variable it must rebind (mirror of theme.ts VAR_MAP).
const MAP: Record<string, string> = {
  bgBase:"--bg", bgGradient:"--bg-gradient", bgGlow:"--bg-glow", waterLight:"--water-light",
  sand:"--sand", coral:"--coral", fish:"--fish", seaweed:"--seaweed", bubble:"--bubble",
  accent:"--accent", accentInk:"--accent-ink", timerActive:"--timer-active", timerPause:"--timer-pause",
  controlBg:"--panel", controlBorder:"--line", panelDeep:"--panel-deep", panelRaised:"--panel-raised",
  fieldBg:"--field-bg", activeBg:"--active-bg", activeBorder:"--active-border", ringTrack:"--ring-track",
  hoverBg:"--hover-bg", popBg:"--pop-bg", textPrimary:"--text", textSecondary:"--muted",
  textFaint:"--text-faint", menuIcon:"--menu-icon",
};

beforeAll(() => {
  vi.stubGlobal("fetch", (url: string) => {
    const id = String(url).split("/themes/")[1].split("/")[0];
    const json = JSON.parse(fs.readFileSync(path.join(themesDir, id, "theme.json"), "utf8"));
    return Promise.resolve({ ok: true, json: () => Promise.resolve(json) });
  });
});

test("every theme rebinds the full UI token set onto :root (no missing inheritance)", async () => {
  for (const id of THEMES) {
    (globalThis as any).THEME = undefined;
    (applyTheme as any).applied = undefined;
    await applyTheme(id);
    const root = document.documentElement.style;
    const json = JSON.parse(fs.readFileSync(path.join(themesDir, id, "theme.json"), "utf8"));
    for (const [token, cssVar] of Object.entries(MAP)) {
      const raw = (json.tokens || {})[token];
      if (raw === undefined) continue; // inherits base, allowed
      const expected = typeof raw === "object" ? raw.color : raw;
      expect(root.getPropertyValue(cssVar).trim(), `${id}/${token}`).toBe(expected);
    }
  }
});

test("reef-realistic keeps its locked default values", async () => {
  (globalThis as any).THEME = undefined;
  (applyTheme as any).applied = undefined;
  await applyTheme("reef-realistic");
  const root = document.documentElement.style;
  expect(root.getPropertyValue("--panel").trim()).toBe("#12232b");
  expect(root.getPropertyValue("--field-bg").trim()).toBe("#0e1d24");
  expect(root.getPropertyValue("--text").trim()).toBe("#e3ede9");
  expect(root.getPropertyValue("--accent").trim()).toBe("#a8deba");
  expect(root.getPropertyValue("--bg").trim()).toBe("#0c1820");
});

test("a light theme (cm-cel) flips control/text vars away from dark defaults", async () => {
  (globalThis as any).THEME = undefined;
  (applyTheme as any).applied = undefined;
  await applyTheme("cm-cel");
  const root = document.documentElement.style;
  expect(root.getPropertyValue("--panel").trim()).toBe("#FFFEFB");
  expect(root.getPropertyValue("--field-bg").trim()).toBe("#e3e7e6");
  expect(root.getPropertyValue("--text").trim()).toBe("#17414D");
  expect(root.getPropertyValue("color-scheme").trim()).toBe("light");
});
