import { test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../src/styles.css";
import { SettingsDialog } from "../src/components/SettingsDialog";
import type { AquariumApi } from "../src/state/useAquarium";
import type { Snapshot } from "../src/state/types";

function makeAq(overrides: Partial<AquariumApi> = {}): AquariumApi {
  return {
    snapshot: {
      revision: 1,
      preferences: { focusMinutes: 25, breakMinutes: 5, sound: "waves", volume: 0.35, soundEnabled: false, chimeEnabled: false },
      session: { id: 1, kind: "focus", status: "idle", task: "", durationMs: 0, elapsedMs: 0, startedAt: "" },
      completed: 0, totalSecs: 0, todaySecs: 0, todayRounds: 0,
      records: [], visitors: [], lastVisitor: "", notice: "", fedSession: 0, nowMs: 0,
      theme: "reef-realistic",
    } as Snapshot,
    themes: [
      { id: "reef-realistic", displayName: "深海写实" },
      { id: "ct-cream", displayName: "奶油软糖" },
    ],
    setTheme: vi.fn(),
    setThemeAuto: vi.fn(),
    setThemeShuffle: vi.fn(),
    saveSettings: vi.fn(),
    exportArchive: vi.fn(),
    importArchive: vi.fn(),
    importFile: vi.fn(),
    checkUpdate: vi.fn(),
    toast: vi.fn(),
    ...overrides,
  } as unknown as AquariumApi;
}

test("automatic theme switch uses live snapshot state and changes immediately", async () => {
  const setThemeAuto = vi.fn();
  const aq = makeAq({ setThemeAuto });
  const { rerender } = render(<SettingsDialog open={true} onClose={vi.fn()} aq={aq} />);
  const toggle = screen.getByRole("switch", { name: "随时间自动切换主题" });
  expect(toggle).not.toBeChecked();
  await userEvent.click(toggle);
  expect(setThemeAuto).toHaveBeenCalledWith(true);
  expect(aq.saveSettings).not.toHaveBeenCalled();
  rerender(<SettingsDialog open={true} onClose={vi.fn()} aq={{ ...aq, snapshot: { ...aq.snapshot!, themeAuto: true } }} />);
  expect(toggle).toBeChecked();
  toggle.focus();
  await userEvent.keyboard(" ");
  expect(setThemeAuto).toHaveBeenLastCalledWith(false);
  expect(screen.getByText(/06:00.*10:00.*17:00.*20:00/)).toBeInTheDocument();
});

test("choosing the active skin exits automatic mode", async () => {
  const aq = makeAq();
  aq.snapshot = { ...aq.snapshot!, themeAuto: true };
  render(<SettingsDialog open={true} onClose={vi.fn()} aq={aq} />);
  await userEvent.click(screen.getByRole("radio", { name: /深海写实/ }));
  expect(aq.setTheme).toHaveBeenCalledOnce();
  expect(aq.setTheme).toHaveBeenCalledWith("reef-realistic");
});

test("all themes shuffle switch follows backend state and supports keyboard toggling", async () => {
  const aq = makeAq();
  const { rerender } = render(<SettingsDialog open={true} onClose={vi.fn()} aq={aq} />);
  const toggle = screen.getByRole("switch", { name: "全部主题随机轮换" });
  expect(toggle).not.toBeChecked();
  await userEvent.click(toggle);
  expect(aq.setThemeShuffle).toHaveBeenCalledWith(true);
  rerender(<SettingsDialog open={true} onClose={vi.fn()} aq={{ ...aq, snapshot: { ...aq.snapshot!, themeShuffle: true } }} />);
  expect(toggle).toBeChecked();
  expect(screen.getByRole("switch", { name: "随时间自动切换主题" })).not.toBeChecked();
  toggle.focus();
  await userEvent.keyboard(" ");
  expect(aq.setThemeShuffle).toHaveBeenLastCalledWith(false);
  await userEvent.click(screen.getByRole("radio", { name: /深海写实/ }));
  expect(aq.setTheme).toHaveBeenCalledWith("reef-realistic");
});

test("theme picker renders backend list as a radiogroup and switches via SetTheme", () => {
  const setTheme = vi.fn();
  render(<SettingsDialog open={true} onClose={vi.fn()} aq={makeAq({ setTheme })} />);

  const group = screen.getByRole("radiogroup", { name: /主题/ });
  expect(group).toBeTruthy();
  const options = screen.getAllByRole("radio");
  expect(options.length).toBe(2);
  // The current theme is checked, the other is not.
  expect(screen.getByRole("radio", { name: /深海写实/ }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("radio", { name: /奶油软糖/ }).getAttribute("aria-checked")).toBe("false");

  fireEvent.click(screen.getByRole("radio", { name: /奶油软糖/ }));
  expect(setTheme).toHaveBeenCalledWith("ct-cream");
});

test("theme radio group supports arrow-key navigation (Radix roving tabindex)", async () => {
  const user = userEvent.setup();
  const setTheme = vi.fn();
  render(<SettingsDialog open={true} onClose={vi.fn()} aq={makeAq({ setTheme })} />);
  const first = screen.getByRole("radio", { name: /深海写实/ });
  first.focus();
  expect(first).toHaveFocus();
  await user.keyboard("{ArrowDown}");
  const second = screen.getByRole("radio", { name: /奶油软糖/ });
  expect(second).toHaveFocus();
  // Space/Enter selects the focused option.
  await user.keyboard(" ");
  expect(setTheme).toHaveBeenCalledWith("ct-cream");
});

test("Escape key closes the settings dialog (Radix Dialog)", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<SettingsDialog open={true} onClose={onClose} aq={makeAq()} />);
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalled();
});

test("unsaved draft survives a fresh preferences object arriving mid-open, but resets on reopen", async () => {
  const user = userEvent.setup();
  const base = makeAq();
  const { rerender } = render(<SettingsDialog open={true} onClose={vi.fn()} aq={base} />);
  const focusInput = screen.getByLabelText(/专注时长/) as HTMLInputElement;
  await user.clear(focusInput);
  await user.type(focusInput, "42");
  expect(focusInput.value).toBe("42");

  const newAq = makeAq();
  newAq.snapshot = { ...base.snapshot!, preferences: { ...base.snapshot!.preferences, focusMinutes: 30 } };
  rerender(<SettingsDialog open={true} onClose={vi.fn()} aq={newAq} />);
  expect((screen.getByLabelText(/专注时长/) as HTMLInputElement).value).toBe("42");

  rerender(<SettingsDialog open={false} onClose={vi.fn()} aq={newAq} />);
  rerender(<SettingsDialog open={true} onClose={vi.fn()} aq={newAq} />);
  expect((screen.getByLabelText(/专注时长/) as HTMLInputElement).value).toBe("30");
});

test("settings form has header / scrollable body / fixed footer regions", () => {
  render(<SettingsDialog open={true} onClose={vi.fn()} aq={makeAq()} />);
  const form = document.getElementById("settings-form") as HTMLElement;
  expect(form).toBeTruthy();
  expect(getComputedStyle(form).display).toBe("flex");
  expect(getComputedStyle(form).flexDirection).toBe("column");
  const body = form.querySelector(".dialog-body") as HTMLElement;
  const footer = form.querySelector(".dialog-footer") as HTMLElement;
  const heading = form.querySelector(".dialog-heading") as HTMLElement;
  expect(body).toBeTruthy();
  expect(footer).toBeTruthy();
  expect(getComputedStyle(body).overflowY).toBe("auto");
  expect(getComputedStyle(body).minHeight).toBe("0");
  expect(getComputedStyle(heading).flexShrink).toBe("0");
  expect(getComputedStyle(footer).display).toBe("flex");
  expect(form.querySelector(".dialog-footer button[type=submit]")).toBeTruthy();
});

test("labels point at range inputs and focus/break live in a two-column grid", () => {
  render(<SettingsDialog open={true} onClose={vi.fn()} aq={makeAq()} />);
  const focus = document.getElementById("focus-minutes") as HTMLInputElement;
  const breakIn = document.getElementById("break-minutes") as HTMLInputElement;
  expect(document.querySelector('label[for="focus-minutes"]')).toBeTruthy();
  expect(document.querySelector('label[for="break-minutes"]')).toBeTruthy();
  const grid = document.querySelector("#settings-form .field-grid") as HTMLElement;
  expect(grid).toBeTruthy();
  expect(getComputedStyle(grid).gridTemplateColumns.split(" ").length).toBe(2);
  expect(document.querySelectorAll("#settings-form .field-grid .field").length).toBe(2);
  expect(focus.value).toBe("25");
  expect(breakIn.value).toBe("5");
});

test("chime row: label text, root click, and Space all toggle once", async () => {
  render(<SettingsDialog open={true} onClose={vi.fn()} aq={makeAq()} />);
  const root = document.getElementById("chime") as HTMLElement;
  expect(root.tagName).toBe("BUTTON");
  // click label text span
  await userEvent.click(document.querySelector("#settings-form .check-row span") as HTMLElement);
  expect(root.getAttribute("data-state")).toBe("checked");
  // click root body
  await userEvent.click(root);
  expect(root.getAttribute("data-state")).toBe("unchecked");
  // Space key on focused root
  root.focus();
  await userEvent.keyboard(" ");
  expect(root.getAttribute("data-state")).toBe("checked");
});

test("theme radio check slot is always mounted (unchecked + checked), constant geometry", () => {
  render(<SettingsDialog open={true} onClose={vi.fn()} aq={makeAq()} />);
  const checks = document.querySelectorAll("#settings-form .theme-option-check");
  expect(checks.length).toBe(2);
  const unchecked = Array.from(checks).find((c) => (c as HTMLElement).getAttribute("data-state") !== "checked");
  const checked = Array.from(checks).find((c) => (c as HTMLElement).getAttribute("data-state") === "checked");
  expect(unchecked).toBeTruthy();
  expect(checked).toBeTruthy();
  const grid = document.querySelector("#settings-form .theme-list") as HTMLElement;
  expect(grid).toBeTruthy();
  expect(getComputedStyle(grid).gridTemplateColumns.split(" ").length).toBe(2);
  expect(document.querySelectorAll("#settings-form .theme-option").length).toBe(2);
});
