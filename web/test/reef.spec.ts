// @vitest-environment node
import { test, expect } from "vitest";
import { Reef } from "../src/reef/Reef";

test("native and browser motion preferences stop and resume the animation scheduler", () => {
  let nextFrame = 0;
  const frames = new Map<number, () => void>();
  let nativeChange: ((p: { reduceMotion?: boolean }) => void) | undefined;
  let mediaChange: (() => void) | undefined;
  let visibilityChange: (() => void) | undefined;
  const media = { matches: false, addEventListener(_event: string, fn: () => void) { mediaChange = fn; } };

  const replacements: Record<string, unknown> = {
    mygo: { preferences: { reduceMotion: true }, on(_event: string, fn: (p: { reduceMotion?: boolean }) => void) { nativeChange = fn; } },
    matchMedia: () => media,
    ResizeObserver: class { observe() {} },
    document: { hidden: false, addEventListener(_event: string, fn: () => void) { visibilityChange = fn; } },
    devicePixelRatio: 1,
    Path2D: class { moveTo() {} lineTo() {} bezierCurveTo() {} quadraticCurveTo() {} arc() {} closePath() {} rect() {} },
    requestAnimationFrame: (fn: () => void) => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
    addEventListener: () => {},
  };

  const previous: Record<string, unknown> = {};
  for (const key of Object.keys(replacements)) {
    previous[key] = (globalThis as Record<string, unknown>)[key];
    (globalThis as Record<string, unknown>)[key] = replacements[key];
  }

  const draw = Reef.prototype.draw;
  let draws = 0;
  Reef.prototype.draw = () => { draws++; };

  try {
    const reef = new Reef({
      getContext: () => ({ setTransform() {} }),
      getBoundingClientRect: () => ({ width: 400, height: 350 }),
    } as unknown as HTMLCanvasElement);
    expect(frames.size).toBe(0);
    reef.update({ fedSession: "before" });
    reef.update({ fedSession: "after" });
    expect(reef.pellets.length).toBe(0);
    expect(draws).toBeGreaterThan(0);
    nativeChange?.({ reduceMotion: false });
    expect(frames.size).toBe(1);
    reef.update({ fedSession: "next" });
    expect(reef.pellets.length).toBeGreaterThan(0);
    media.matches = true; mediaChange?.();
    expect(frames.size).toBe(0);
    expect(reef.pellets.length).toBe(0);
    nativeChange?.({ reduceMotion: false });
    expect(frames.size).toBe(0);
    media.matches = false; mediaChange?.();
    expect(frames.size).toBe(1);
    (globalThis as { document: { hidden: boolean } }).document.hidden = true; visibilityChange?.();
    expect(frames.size).toBe(0);
    (globalThis as { document: { hidden: boolean } }).document.hidden = false; visibilityChange?.();
    expect(frames.size).toBe(1);
    nativeChange?.({ reduceMotion: true });
    expect(frames.size).toBe(0);
  } finally {
    Reef.prototype.draw = draw;
    for (const key of Object.keys(replacements)) {
      if (previous[key] === undefined) delete (globalThis as Record<string, unknown>)[key];
      else (globalThis as Record<string, unknown>)[key] = previous[key];
    }
  }
});
