import { test, expect, vi, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import "../src/styles.css";
import { SettingsDialog } from "../src/components/SettingsDialog";
import type { AquariumApi } from "../src/state/useAquarium";
import type { Snapshot } from "../src/state/types";

function aq(): AquariumApi {
  return {
    snapshot: {
      revision: 1,
      preferences: { focusMinutes: 25, breakMinutes: 5, sound: "waves", volume: 0.35, soundEnabled: false, chimeEnabled: false },
      session: { id: 1, kind: "focus", status: "idle", task: "", durationMs: 0, elapsedMs: 0, startedAt: "" },
      completed: 0, totalSecs: 0, todaySecs: 0, todayRounds: 0,
      records: [], visitors: [], lastVisitor: "", notice: "", fedSession: 0, nowMs: 0, theme: "reef-realistic",
    } as Snapshot,
    themes: [{ id: "reef-realistic", displayName: "深海写实" }],
    setTheme: vi.fn(), saveSettings: vi.fn(), exportArchive: vi.fn(), importArchive: vi.fn(),
    importFile: vi.fn(), checkUpdate: vi.fn(), toast: vi.fn(),
  } as unknown as AquariumApi;
}

beforeAll(() => {
  // Give --panel a concrete value so var(--panel) resolves to a color we can assert.
  document.documentElement.style.setProperty("--panel", "rgb(10, 20, 30)");
});

function settingsRule(): CSSRule | undefined {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule.cssText.includes("#settings-form")) return rule;
      }
    } catch { /* cross-origin */ }
  }
  return undefined;
}

test("real stylesheet centers the form: fixed, 50%/50%, translate(-50%,-50%), z41, panel bg", () => {
  render(<SettingsDialog open={true} onClose={vi.fn()} aq={aq()} />);
  const form = document.getElementById("settings-form") as HTMLElement;
  expect(form).toBeTruthy();

  const cs = getComputedStyle(form);
  expect(cs.position).toBe("fixed");
  expect(cs.zIndex).toBe("41");

  // CSSOM declarations from the real injected stylesheet (not a source grep).
  const rule = settingsRule() as CSSStyleRule;
  expect(rule).toBeTruthy();
  const text = rule.style.cssText;
  expect(text).toMatch(/top:\s*50%/);
  expect(text).toMatch(/left:\s*50%/);
  expect(text).toMatch(/translate\(-50%,\s*-50%\)/);
  expect(text).toMatch(/z-index:\s*41/);
  // The panel background is declared via the theme token (jsdom cannot resolve
  // the var() shorthand to a color; that pixel check is left to WKWebView).
  expect(text).toMatch(/background:\s*var\(--panel\)/);
  expect(text).toMatch(/border:\s*1px solid var\(--line\)/);
});

test("old selector #settings-dialog does NOT match the asChild form (the regression that left it uncentered)", () => {
  // Simulate the old/broken stylesheet targeting #settings-dialog. If that id
  // actually applied to the form, this would force static+red; it must not.
  const probe = document.createElement("style");
  probe.textContent = "#settings-dialog{position:static !important; background:rgb(255,0,0) !important; z-index:1 !important;}";
  document.head.appendChild(probe);

  render(<SettingsDialog open={true} onClose={vi.fn()} aq={aq()} />);
  const form = document.getElementById("settings-form") as HTMLElement;
  const cs = getComputedStyle(form);
  expect(cs.position).toBe("fixed");
  expect(cs.zIndex).toBe("41");
  probe.remove();
});
