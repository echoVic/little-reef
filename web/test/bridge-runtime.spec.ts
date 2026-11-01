import { test, expect, vi, beforeEach } from "vitest";

const handlers: Record<string, (p: unknown) => void> = {};
let offCount = 0;

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k];
  offCount = 0;
  (globalThis as Record<string, unknown>).mygo = {
    on: (name: string, cb: (p: unknown) => void) => {
      handlers[name] = cb;
      return () => { offCount++; };
    },
    call: vi.fn(),
  };
});

test("onAudioRequest subscribes to the real runtime event name", async () => {
  const { onAudioRequest } = await import("../src/state/bridge");
  const cb = vi.fn();
  const off = onAudioRequest(cb);
  expect(handlers["desktop:audio-request"]).toBeTypeOf("function");
  handlers["desktop:audio-request"]({ requestId: "x", command: "enable" });
  expect(cb).toHaveBeenCalledWith(expect.objectContaining({ requestId: "x" }));
  off();
  expect(offCount).toBe(1);
});

test("onUiRequest routes set-compact through runtime", async () => {
  const { onUiRequest } = await import("../src/state/bridge");
  const cb = vi.fn();
  onUiRequest(cb);
  handlers["desktop:ui-request"]({ requestId: "u", command: "set-compact", compact: true });
  expect(cb).toHaveBeenCalledWith(expect.objectContaining({ command: "set-compact", compact: true }));
});
