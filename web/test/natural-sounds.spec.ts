import { describe, expect, it } from "vitest";
import { ICONS } from "../src/icons";
import { readFileSync } from "node:fs";

const SRC = readFileSync("src/audio/soundscape.ts", "utf8");

const IDS = ["waves","rain","thunder","stream","bubbles","boil","deepsea",
  "wind","fire","forest","summer","night","desert","morning",
  "clock","knock","cafe","musicbox","traffic","pink"];

describe("original sound assets (audio-redesign experiment cancelled)", () => {
  it("has exactly 20 unique ids", () => {
    expect(new Set(IDS).size).toBe(20);
  });
  it("every sound icon is registered", () => {
    for (const id of IDS) {
      expect(ICONS as Record<string, unknown>, id).toHaveProperty(id);
    }
  });
  it("legacy seams restored (clock/knock/musicbox)", () => {
    expect(SRC).toMatch(/const seams/);
    expect(SRC).toMatch(/function pink\(/);
  });
  it("pink is synthesized at runtime, not loaded from mp3", () => {
    expect(SRC).toMatch(/kind === "pink" \? Promise\.resolve\(\)\.then/);
  });
});
