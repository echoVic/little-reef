import { test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock the I/O boundary: RPC call, subscription transport, theme application and audio graph.
const callMock = vi.fn();
const applyThemeMock = vi.fn().mockResolvedValue(undefined);
const soundInstances: { set: ReturnType<typeof vi.fn>; unlock: ReturnType<typeof vi.fn>; chime: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[] = [];
let subscriber: { apply: (s: unknown) => void; connected: (h: boolean) => void; error: (e: Error) => void } | null = null;

vi.mock("../src/state/bridge", () => ({
  call: (...args: unknown[]) => callMock(...args),
  subscribe: vi.fn(() => Promise.resolve(() => { subscriber = null; })),
  desktop: false,
}));
vi.mock("../src/theme/theme", () => ({ applyTheme: (...args: unknown[]) => applyThemeMock(...args) }));
vi.mock("../src/audio/soundscape", () => ({
  Soundscape: class {
    constructor() {
      soundInstances.push(this as unknown as { set: ReturnType<typeof vi.fn> });
    }
    set = vi.fn().mockResolvedValue(undefined);
    unlock = vi.fn().mockResolvedValue(undefined);
    chime = vi.fn();
    dispose = vi.fn();
    setOnChanged = vi.fn();
    audioState = vi.fn(() => ({ contextRunning: false, requested: false, sound: "waves", volume: 0.35, started: false, error: "" }));
  },
}));

import { useAquarium } from "../src/state/useAquarium";
import { subscribe } from "../src/state/bridge";
import type { Snapshot } from "../src/state/types";

function snap(rev: number, over: Partial<Snapshot> = {}): Snapshot {
  return {
    revision: rev,
    preferences: { focusMinutes: 25, breakMinutes: 5, sound: "waves", volume: 0.35, soundEnabled: false, chimeEnabled: false },
    session: { id: 1, kind: "focus", status: "idle", task: "", durationMs: 25 * 60000, elapsedMs: 0, startedAt: "" },
    completed: 0, totalSecs: 0, todaySecs: 0, todayRounds: 0,
    records: [], visitors: [], lastVisitor: "", notice: "", fedSession: 0, nowMs: 0,
    ...over,
  } as unknown as Snapshot;
}

beforeEach(() => {
  vi.clearAllMocks();
  subscriber = null;
  soundInstances.length = 0;
  callMock.mockResolvedValue([]);
  (subscribe as unknown as ReturnType<typeof vi.fn>).mockImplementation((sub: typeof subscriber) => {
    subscriber = sub; return Promise.resolve(() => { subscriber = null; });
  });
});

test("revision guard: a stale snapshot with a lower revision is dropped", async () => {
  const { result } = renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  expect(subscriber).toBeTruthy();
  act(() => subscriber!.apply(snap(5)));
  expect(result.current.snapshot?.revision).toBe(5);
  act(() => subscriber!.apply(snap(2)));
  expect(result.current.snapshot?.revision).toBe(5); // rejected
  act(() => subscriber!.apply(snap(6)));
  expect(result.current.snapshot?.revision).toBe(6);
});

test("broken connection flips healthy off and forces sound off", async () => {
  const { result } = renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  act(() => { subscriber!.apply(snap(1)); subscriber!.connected(true); });
  expect(result.current.healthy).toBe(true);
  act(() => subscriber!.connected(false));
  expect(result.current.healthy).toBe(false);
  expect(result.current.soundPlaying).toBe(false);
  expect(soundInstances[0].set).toHaveBeenCalledWith(false, "waves", 0.35);
});

test("busy lock: a pending mutation blocks a second concurrent RPC", async () => {
  let release: (v: unknown) => void = () => {};
  callMock.mockImplementation((method: string) => method === "Aquarium.GetThemes"
    ? Promise.resolve([])
    : new Promise((res) => { release = res; }));
  const { result } = renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  act(() => subscriber!.apply(snap(1)));
  act(() => subscriber!.connected(true));

  await act(async () => { result.current.primary(); });
  expect(result.current.busy).toBe(true);
  // second call while busy must not issue another Start
  const startCalls = callMock.mock.calls.filter((c) => c[0] === "Aquarium.Start").length;
  act(() => result.current.feed());
  expect(callMock.mock.calls.filter((c) => c[0] === "Aquarium.Start").length).toBe(startCalls);
  expect(callMock.mock.calls.filter((c) => c[0] === "Aquarium.Feed").length).toBe(0);
  await act(async () => { release(snap(2)); });
  expect(result.current.busy).toBe(false);
});

test("mutations are refused while disconnected", async () => {
  const { result } = renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  act(() => subscriber!.apply(snap(1)));
  act(() => subscriber!.connected(false));
  await act(async () => { result.current.primary(); });
  expect(callMock.mock.calls.filter((c) => c[0] === "Aquarium.Start")).toHaveLength(0);
});

test("loading an already-running session does not autoplay sound", async () => {
  const { result } = renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  const running = snap(1, {
    preferences: { focusMinutes: 25, breakMinutes: 5, sound: "waves", volume: 0.35, soundEnabled: true, chimeEnabled: false },
    session: { id: 7, kind: "focus", status: "running", task: "", durationMs: 1500000, elapsedMs: 600000, startedAt: "" },
  });
  act(() => subscriber!.apply(running));
  expect(result.current.soundPlaying).toBe(false);
});

function pressSpace(target: EventTarget) {
  const ev = new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
}

test("Space on body starts the timer; Space on an interactive control does not", async () => {
  renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  act(() => { subscriber!.apply(snap(1)); subscriber!.connected(true); });
  callMock.mockClear();

  await act(async () => { pressSpace(document.body); });
  expect(callMock.mock.calls.filter((c) => c[0] === "Aquarium.Start")).toHaveLength(1);
});

test("modified Space does not trigger a second timer shortcut", async () => {
  renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  act(() => subscriber!.apply(snap(1)));
  callMock.mockClear();
  callMock.mockResolvedValue(snap(2));
  for (const modifier of ["metaKey", "ctrlKey", "altKey", "shiftKey"]) {
    await act(async () => { document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true, [modifier]: true })); });
  }
  expect(callMock.mock.calls.some((call) => call[0] === "Aquarium.Start")).toBe(false);
});

test("Space while a Radix dialog (role=dialog data-state=open) is open does not trigger timer", async () => {
  renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  act(() => { subscriber!.apply(snap(1)); subscriber!.connected(true); });
  callMock.mockClear();
  const overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("data-state", "open");
  document.body.appendChild(overlay);

  await act(async () => { pressSpace(document.body); });
  expect(callMock.mock.calls.filter((c) => c[0] === "Aquarium.Start")).toHaveLength(0);
  overlay.remove();
});

test("Space focused on a slider/radio control does not trigger timer", async () => {
  renderHook(() => useAquarium());
  await act(async () => { await Promise.resolve(); });
  act(() => { subscriber!.apply(snap(1)); subscriber!.connected(true); });
  callMock.mockClear();
  const thumb = document.createElement("div");
  thumb.setAttribute("role", "slider");
  thumb.tabIndex = 0;
  document.body.appendChild(thumb);

  await act(async () => { pressSpace(thumb); });
  expect(callMock.mock.calls.filter((c) => c[0] === "Aquarium.Start")).toHaveLength(0);
  thumb.remove();
});
