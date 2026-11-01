import { test, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the hook boundary (RPC/state), but render the REAL App so the actual
// Radix Slider wiring (onValueChange preview + onValueCommit RPC) is exercised.
const setVolume = vi.fn();
let volume = 0.35;
vi.mock("../src/state/useAquarium", () => ({
  useAquarium: () => ({
    snapshot: {
      revision: 1,
      preferences: { focusMinutes: 25, breakMinutes: 5, sound: "waves", volume, soundEnabled: false, chimeEnabled: false },
      session: { id: 1, kind: "focus", status: "idle", task: "", durationMs: 0, elapsedMs: 0, startedAt: "" },
      completed: 0, totalSecs: 0, todaySecs: 0, todayRounds: 0,
      records: [], visitors: [], lastVisitor: "", notice: "", fedSession: 0, nowMs: 0, theme: "reef-realistic",
    },
    timer: { time: "25:00", ringOffset: 0, ringPaused: false, statusText: "", primaryLabel: "", primaryIcon: "play",
      taskDisabled: false, taskPlaceholder: "", endHidden: true, footnote: "", feedDisabled: true, feedLabel: "",
      growthLabel: "", nextGrowth: "", caption: "" },
    busy: false, healthy: true, soundPlaying: false, soundStatus: "", themes: [],
    selectedKind: "focus",
    setSelectedKind: vi.fn(), primary: vi.fn(), endSession: vi.fn(), feed: vi.fn(),
    pickSound: vi.fn(), setVolume, toggleSound: vi.fn(), setTheme: vi.fn(),
    saveSettings: vi.fn(), exportArchive: vi.fn(), importArchive: vi.fn(), importFile: vi.fn(),
    checkUpdate: vi.fn(), setCompact: vi.fn(), hide: vi.fn(), quit: vi.fn(), toast: vi.fn(),
    toastMessage: "", soundRef: { current: null }, reefRef: { current: null }, notifyThemeChanged: vi.fn(),
    openSettings: vi.fn(),
  }),
}));
vi.mock("../src/state/bridge", () => ({ desktop: false, call: vi.fn(), subscribe: vi.fn(() => Promise.resolve(() => {})) }));
vi.mock("../src/theme/theme", () => ({
  applyTheme: vi.fn().mockResolvedValue(undefined),
  themeColor: (_t: string, fallback: string) => fallback,
  themeMotion: (key: string) => (key === "bubbleDensity" ? 1 : 1),
}));

import { App } from "../src/App";

test("browser settings retains the web dialog", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "计时设置" }));
  expect(screen.getByRole("dialog", { name: "按自己的节奏来" })).toBeInTheDocument();
});

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => undefined }) as unknown as CanvasRenderingContext2D;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) as MediaQueryList);
});

test("slider arrow keys move aria-valuenow live (preview) and commit fires the RPC", async () => {
  const user = userEvent.setup();
  render(<App />);
  const thumb = screen.getAllByRole("slider")[0];
  expect(thumb.getAttribute("aria-valuenow")).toBe("35");

  await user.click(thumb);
  await user.keyboard("{ArrowRight}");
  expect(thumb.getAttribute("aria-valuenow")).toBe("36");
  await user.keyboard("{ArrowRight}");
  expect(thumb.getAttribute("aria-valuenow")).toBe("37");

  // Each arrow keyup is a commit; the RPC receives the committed preview value.
  expect(setVolume).toHaveBeenCalledWith(36);
  expect(setVolume).toHaveBeenCalledWith(37);
});
