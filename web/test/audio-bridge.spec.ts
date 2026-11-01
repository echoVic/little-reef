import { test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const callMock = vi.fn();
const audioHandlers: ((e: unknown) => void)[] = [];
const uiHandlers: ((e: unknown) => void)[] = [];
const shortcutHandlers: ((e: { spaceEnabled: boolean }) => void)[] = [];
const soundApi = {
  set: vi.fn().mockResolvedValue(undefined),
  unlock: vi.fn().mockResolvedValue(undefined),
  chime: () => {}, dispose: () => {}, setOnChanged: vi.fn(), cancel: vi.fn(),
  audioState: vi.fn(() => ({ contextRunning: false, requested: false, sound: "waves", volume: 0.35, started: false, error: "" })),
};
let subscriber: { apply: (s: unknown) => void; connected: (h: boolean) => void; error: (e: Error) => void } | null = null;

vi.mock("../src/state/bridge", () => ({
  call: (...args: unknown[]) => callMock(...args),
  subscribe: vi.fn(() => Promise.resolve(() => { subscriber = null; })),
  desktop: true,
  onAudioRequest: (cb: (e: unknown) => void) => { audioHandlers.push(cb); return () => {}; },
  onUiRequest: (cb: (e: unknown) => void) => { uiHandlers.push(cb); return () => {}; },
  onShortcutSettings: (cb: (e: { spaceEnabled: boolean }) => void) => { shortcutHandlers.push(cb); return () => {}; },
}));
vi.mock("../src/theme/theme", () => ({ applyTheme: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../src/audio/soundscape", () => ({
  Soundscape: class { audioState = soundApi.audioState; set = soundApi.set; unlock = soundApi.unlock; chime = soundApi.chime; dispose = soundApi.dispose; setOnChanged = soundApi.setOnChanged; cancel = soundApi.cancel; },
}));

import { useAquarium } from "../src/state/useAquarium";
import { subscribe } from "../src/state/bridge";
import type { Snapshot } from "../src/state/types";

function snap(rev: number, over: Partial<Snapshot> = {}): Snapshot {
  return {
    revision: rev,
    preferences: { focusMinutes: 25, breakMinutes: 5, sound: "waves", volume: 0.35, soundEnabled: false, chimeEnabled: false },
    session: { id: 1, kind: "focus", status: "idle", task: "", durationMs: 0, elapsedMs: 0, startedAt: "" },
    completed: 0, totalSecs: 0, todaySecs: 0, records: [], visitors: [], lastVisitor: "", notice: "", fedSession: 0, nowMs: 0,
    ...over,
  } as unknown as Snapshot;
}

beforeEach(() => {
  vi.clearAllMocks();
  soundApi.set.mockResolvedValue(undefined);
  audioHandlers.length = 0; uiHandlers.length = 0;
  shortcutHandlers.length = 0;
  subscriber = null;
  document.body.classList.remove("compact");
  soundApi.audioState.mockReturnValue({ contextRunning: false, requested: false, sound: "waves", volume: 0.35, started: false, error: "" });
  callMock.mockImplementation((method: string, ...args: unknown[]) => {
    if (method === "Aquarium.GetThemes") return Promise.resolve([] as never);
    if (method === "Desktop.GetCompact") return Promise.resolve(false);
    if (method === "Desktop.GetShortcutSettings") return Promise.resolve({ bindings: [], spaceEnabled: true });
    if (method === "Aquarium.SetPreferences") return Promise.resolve(snap(2, { preferences: args[0] as Snapshot["preferences"] }));
    return Promise.resolve(snap(1));
  });
  (subscribe as unknown as ReturnType<typeof vi.fn>).mockImplementation((sub: typeof subscriber) => {
    subscriber = sub; sub.apply(snap(1)); sub.connected(true);
    return Promise.resolve(() => { subscriber = null; });
  });
});

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test("plain Space obeys saved and live native shortcut settings", async () => {
  callMock.mockImplementation((method: string) => Promise.resolve(method === "Desktop.GetShortcutSettings" ? { bindings: [], spaceEnabled: false } : method === "Desktop.GetCompact" ? false : method === "Aquarium.GetThemes" ? [] : snap(1)));
  renderHook(() => useAquarium());
  await act(async () => { await flush(); });
  await act(async () => { document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true })); await flush(); });
  expect(callMock.mock.calls.some((call) => call[0] === "Aquarium.Start")).toBe(false);
  await act(async () => { shortcutHandlers[0]({ spaceEnabled: true }); await flush(); });
  await act(async () => { document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true })); await flush(); });
  expect(callMock).toHaveBeenCalledWith("Aquarium.Start", "focus", "");
});

test("native compact layout is restored on startup without a new layout event", async () => {
  callMock.mockImplementation((method: string) => Promise.resolve(method === "Desktop.GetCompact" ? true : method === "Aquarium.GetThemes" ? [] : snap(1)));
  renderHook(() => useAquarium());
  await act(async () => { await flush(); });
  expect(document.body).toHaveClass("compact");
});

test("a live compact event wins over a stale initial layout read", async () => {
  let resolveMode!: (compact: boolean) => void;
  callMock.mockImplementation((method: string) => method === "Desktop.GetCompact"
    ? new Promise<boolean>((resolve) => { resolveMode = resolve; })
    : Promise.resolve(method === "Aquarium.GetThemes" ? [] : snap(1)));
  renderHook(() => useAquarium());
  await act(async () => { await flush(); });
  await act(async () => { uiHandlers[0]({ requestId: "new-mode", command: "set-compact", compact: true }); await flush(); });
  await act(async () => { resolveMode(false); await flush(); });
  expect(document.body).toHaveClass("compact");
});

test("a newer native mode wins over a delayed local compact reply", async () => {
  let finishLocal!: () => void;
  callMock.mockImplementation((method: string) => method === "Desktop.SetCompact"
    ? new Promise<void>((resolve) => { finishLocal = resolve; })
    : Promise.resolve(method === "Desktop.GetCompact" ? false : method === "Aquarium.GetThemes" ? [] : snap(1)));
  const { result } = renderHook(() => useAquarium());
  await act(async () => { await flush(); });
  await act(async () => { result.current.setCompact(true); await flush(); });
  await act(async () => { uiHandlers[0]({ requestId: "newer-mode", command: "set-compact", compact: false }); await flush(); });
  await act(async () => { finishLocal(); await flush(); });
  expect(document.body).not.toHaveClass("compact");
});

test.each(["native", "main"])("pausing a round wins over a delayed %s sound-enable reply", async (origin) => {
  let finishPreferences!: (next: Snapshot) => void;
  callMock.mockImplementation((method: string) => method === "Aquarium.SetPreferences"
    ? new Promise<Snapshot>((resolve) => { finishPreferences = resolve; })
    : Promise.resolve(method === "Desktop.GetCompact" ? false : method === "Aquarium.GetThemes" ? [] : snap(1)));
  const { result } = renderHook(() => useAquarium());
  await act(async () => { await flush(); });
  const running = snap(2, { session: { id: 1, kind: "focus", status: "running", task: "", durationMs: 60000, elapsedMs: 0, startedAt: "" } });
  await act(async () => { subscriber!.apply(running); await flush(); });
  await act(async () => {
    if (origin === "native") audioHandlers[0]({ requestId: "delayed-enable", command: "enable" });
    else result.current.toggleSound();
    await flush();
  });
  const enabled = { ...running.preferences, soundEnabled: true };
  await act(async () => { subscriber!.apply(snap(4, { session: { ...running.session, status: "paused" }, preferences: enabled })); await flush(); });
  await act(async () => { finishPreferences(snap(3, { session: running.session, preferences: enabled })); await flush(); });
  expect(result.current.snapshot?.session.status).toBe("paused");
  expect(result.current.soundPlaying).toBe(false);
  expect(soundApi.set).toHaveBeenLastCalledWith(false, "waves", 0.35);
});

test.each(["enable", "set-volume"])("a settled %s request cannot cancel playback ten seconds later", async (command) => {
  vi.useFakeTimers();
  try {
    renderHook(() => useAquarium());
    await act(async () => { await flush(); });
    await act(async () => { audioHandlers[0]({ requestId: "ready", command: "enable" }); await flush(); });
    if (command === "set-volume") {
      await act(async () => { audioHandlers[0]({ requestId: "volume", command, volume: 0.5 }); await flush(); });
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(soundApi.cancel).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

test("enable via runtime event awaits the actual source start, not a fixed timer", async () => {
  let resolveSet!: () => void;
  soundApi.set.mockImplementation(() => new Promise<void>((res) => { resolveSet = res; }));
  renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  expect(audioHandlers.length).toBe(1);

  await act(async () => { audioHandlers[0]({ requestId: "r1", command: "enable" }); await flush(); });
  // Before set() resolves, no ACK yet (no 700ms false-positive).
  expect(callMock.mock.calls.find((c) => c[0] === "Desktop.ReportAudioState" && c[1] === "r1")).toBeFalsy();
  soundApi.audioState.mockReturnValue({ contextRunning: true, requested: true, sound: "waves", volume: 0.35, started: true, error: "" });
  await act(async () => { resolveSet(); await flush(); });
  const report = callMock.mock.calls.find((c) => c[0] === "Desktop.ReportAudioState" && c[1] === "r1");
  expect(report).toBeTruthy();
  expect(report![2].running).toBe(true);
});

test("a second native command while one is in flight is rejected as busy", async () => {
  let resolveSet!: () => void;
  soundApi.set.mockImplementation(() => new Promise<void>((res) => { resolveSet = res; }));
  renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  await act(async () => { audioHandlers[0]({ requestId: "a", command: "enable" }); await flush(); });
  await act(async () => { audioHandlers[0]({ requestId: "b", command: "disable" }); await flush(); });
  const busy = callMock.mock.calls.find((c) => c[0] === "Desktop.ReportAudioState" && c[1] === "b");
  expect(busy).toBeTruthy();
  expect(busy![2].error).toBe("busy");
  resolveSet();
});

test("requested but context not running reports needGesture, never false-positive playing", async () => {
  soundApi.set.mockResolvedValue(undefined);
  renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  soundApi.audioState.mockReturnValue({ contextRunning: false, requested: true, sound: "waves", volume: 0.35, started: false, error: "" });
  await act(async () => { audioHandlers[0]({ requestId: "r2", command: "toggle" }); await flush(); });
  const report = callMock.mock.calls.find((c) => c[0] === "Desktop.ReportAudioState" && c[1] === "r2");
  expect(report![2].running).toBe(false);
  expect(report![2].needGesture).toBe(true);
});

test("10s timeout cancels the pending source, ACKs non-playing, releases the lock, and a late resolve cannot replay", async () => {
  let lateResolve!: () => void;
  soundApi.set.mockImplementation(() => new Promise<void>((res) => { lateResolve = res; }));
  renderHook(() => useAquarium());
  await act(async () => { await flush(); });
  expect(audioHandlers.length).toBe(1);
  vi.useFakeTimers();
  await act(async () => { audioHandlers[0]({ requestId: "t", command: "enable" }); await flush(); });
  // Before the timeout: no ACK, lock held.
  expect(soundApi.cancel).not.toHaveBeenCalled();
  expect(callMock.mock.calls.find((c) => c[0] === "Desktop.ReportAudioState" && c[1] === "t")).toBeFalsy();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(soundApi.cancel).toHaveBeenCalled();
  const report = callMock.mock.calls.find((c) => c[0] === "Desktop.ReportAudioState" && c[1] === "t");
  expect(report).toBeTruthy();
  expect(report![2].running).toBe(false);
  // Late decode resolving after cancel must not re-trigger playback.
  await act(async () => { lateResolve(); await flush(); });
  expect(soundApi.audioState().requested).toBe(false);
  vi.useRealTimers();
});

test("a main gesture mutation is blocked while a native command holds the lock", async () => {
  let resolveSet!: () => void;
  soundApi.set.mockImplementation(() => new Promise<void>((res) => { resolveSet = res; }));
  const { result } = renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  await act(async () => { audioHandlers[0]({ requestId: "a", command: "enable" }); await flush(); });
  // While native enable is settling, a page gesture must not interleave prefs.
  await act(async () => { result.current.toggleSound(); await flush(); });
  const setCalls = callMock.mock.calls.filter((c) => c[0] === "Aquarium.SetPreferences");
  expect(setCalls.length).toBe(1);
  resolveSet();
});

test("unknown command is rejected, never falls back to toggle", async () => {
  renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  await act(async () => { audioHandlers[0]({ requestId: "rx", command: "explode" }); await flush(); });
  expect(callMock).not.toHaveBeenCalledWith("Aquarium.SetPreferences", expect.anything());
});

test("set-volume persists and ACKs observed volume", async () => {
  renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  soundApi.audioState.mockReturnValue({ contextRunning: true, requested: true, sound: "waves", volume: 0.5, started: true, error: "" });
  await act(async () => { audioHandlers[0]({ requestId: "v1", command: "set-volume", volume: 0.5 }); await flush(); });
  expect(callMock).toHaveBeenCalledWith("Aquarium.SetPreferences", expect.objectContaining({ volume: 0.5 }));
  expect(callMock.mock.calls.find((c) => c[0] === "Desktop.ReportAudioState" && c[1] === "v1")![2].volume).toBe(0.5);
});

test("set-compact syncs body class only (no duplicate SetCompact) and ACKs", async () => {
  renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  await act(async () => { uiHandlers[0]({ requestId: "c1", command: "set-compact", compact: true }); await flush(); });
  expect(callMock).not.toHaveBeenCalledWith("Desktop.SetCompact", expect.anything());
  expect(document.body.classList.contains("compact")).toBe(true);
  expect(callMock).toHaveBeenCalledWith("Desktop.AckUIRequest", "c1", true, "");
});

test("openSettings calls the native window directly without a UI ACK", async () => {
  const { result } = renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  await act(async () => { result.current.openSettings(); await flush(); });
  expect(callMock).toHaveBeenCalledWith("Desktop.OpenSettings");
  expect(callMock.mock.calls.some((call) => call[0] === "Desktop.AckUIRequest")).toBe(false);
});
