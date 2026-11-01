import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const hide = vi.fn();
const quit = vi.fn();
const setCompact = vi.fn();
const openSettings = vi.fn();

vi.mock("../src/state/useAquarium", () => ({
  useAquarium: () => ({
    snapshot: {
      revision: 1,
      preferences: { focusMinutes: 25, breakMinutes: 5, sound: "waves", volume: 0.35, soundEnabled: false, chimeEnabled: false },
      session: { id: 1, kind: "focus", status: "idle", task: "", durationMs: 0, elapsedMs: 0, startedAt: "" },
      completed: 0, totalSecs: 0, todaySecs: 0, records: [], visitors: [], lastVisitor: "", notice: "", fedSession: 0, nowMs: 0, theme: "reef-realistic",
    },
    timer: { time: "25:00", ringOffset: 0, ringPaused: false, statusText: "", primaryLabel: "", primaryIcon: "play",
      taskDisabled: false, taskPlaceholder: "", endHidden: true, footnote: "", feedDisabled: true, feedLabel: "",
      growthLabel: "", nextGrowth: "", caption: "" },
    busy: false, healthy: true, soundPlaying: false, soundStatus: "", themes: [], selectedKind: "focus",
    setSelectedKind: vi.fn(), primary: vi.fn(), endSession: vi.fn(), feed: vi.fn(), pickSound: vi.fn(), setVolume: vi.fn(),
    toggleSound: vi.fn(), setTheme: vi.fn(), saveSettings: vi.fn(), exportArchive: vi.fn(), importArchive: vi.fn(),
    importFile: vi.fn(), checkUpdate: vi.fn(), setCompact, openSettings, hide, quit, toast: vi.fn(), toastMessage: "",
    soundRef: { current: null }, reefRef: { current: null }, notifyThemeChanged: vi.fn(),
  }),
}));
vi.mock("../src/state/bridge", () => ({ desktop: true, call: vi.fn(), subscribe: vi.fn().mockResolvedValue(() => {}), onAudioRequest: () => () => {}, onUiRequest: () => () => {} }));
vi.mock("../src/reef/ReefCanvas", () => ({ ReefCanvas: () => null }));

import { App } from "../src/App";

test("desktop titlebar leaves close and minimize controls to the native window", () => {
  render(<App />);
  expect(screen.queryByRole("button", { name: /收起到托盘/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /关闭窗口/ })).toBeNull();
  expect(hide).not.toHaveBeenCalled();
  expect(quit).not.toHaveBeenCalled();
});

test("compact toggle still routes to setCompact", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: /切换桌面挂件/ }));
  expect(setCompact).toHaveBeenCalled();
});

test("desktop settings opens the native window without mounting the web dialog", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "计时设置" }));
  expect(openSettings).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog", { name: "按自己的节奏来" })).toBeNull();
});
