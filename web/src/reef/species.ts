import { Fish } from "./engine/fish.js";
import { Shrimp } from "./engine/shrimp.js";
import { Hermit } from "./engine/hermit.js";
import { Crab } from "./engine/crab.js";
import { Mantis } from "./engine/mantis.js";

// Boundary types for the reused canvas engine. The engine itself is plain JS;
// this layer is the typed species registry the app and tests rely on.
export interface SpeciesColors {
  back: string;
  flank?: string;
  belly?: string;
  fin?: string;
  iris?: string;
  [key: string]: string | undefined;
}

export interface SpeciesSpec {
  id: string;
  model: string;
  length: number;
  zone?: [number, number];
  speed: number;
  hover?: number;
  home?: boolean;
  wiggle?: boolean;
  burst?: boolean;
  upstream?: boolean;
  propulsion?: string;
  curious?: boolean;
  rocky?: boolean;
  range?: number;
  rock?: boolean;
  idle?: number;
  burrow?: boolean;
  depths?: [number, number];
  sideways?: boolean;
  colors?: SpeciesColors;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModelCtor = new (spec: SpeciesSpec, world: any, options?: { enter?: boolean }) => any;

const MODELS: Record<string, ModelCtor> = {
  fish: Fish as unknown as ModelCtor,
  shrimp: Shrimp as unknown as ModelCtor,
  mantis: Mantis as unknown as ModelCtor,
  hermit: Hermit as unknown as ModelCtor,
  crab: Crab as unknown as ModelCtor,
};

// Every creature's model and habits. Lengths are in centimeters. The ids match
// the visitor list in state.go.
export const SPECIES: Record<string, SpeciesSpec> = {
  resident: { id: "resident", model: "fish", length: 8.5, zone: [0.16, 0.6], speed: 1.1, hover: 0.35, burst: true, upstream: true, propulsion: "tail",
    colors: { back: "#df7a3e", flank: "#f09a54", belly: "#f8cf99", fin: "#f4a24f", iris: "#e9b45a" } },
  clown: { id: "clown", model: "fish", length: 7, zone: [0.3, 0.85], speed: 0.9, hover: 0.5, home: true, wiggle: true, propulsion: "tail",
    colors: { back: "#dc6624", flank: "#ee8538", belly: "#f6a255", fin: "#ee8a3c", iris: "#f0a54a" } },
  tang: { id: "tang", model: "fish", length: 9.5, zone: [0.12, 0.72], speed: 1, hover: 0.2, propulsion: "pectoral",
    colors: { back: "#1e4ead", flank: "#3367c6", belly: "#6c95d6", fin: "#2c5ab6", iris: "#22283a" } },
  angel: { id: "angel", model: "fish", length: 10, zone: [0.38, 0.8], speed: 0.65, hover: 0.45, rocky: true, propulsion: "tail",
    colors: { back: "#2b6d80", flank: "#4f9a8e", belly: "#a7c77d", fin: "#3a8fa3", iris: "#d8b450" } },
  puffer: { id: "puffer", model: "fish", length: 6.5, zone: [0.48, 0.88], speed: 0.5, hover: 0.6, curious: true, propulsion: "fins",
    colors: { back: "#e8d8be", flank: "#f2eadb", belly: "#fbf7ef", fin: "#f1dfab", iris: "#7dc6b4" } },
  cleaner: { id: "cleaner", model: "shrimp", length: 6.5, speed: 0.55, range: 0.12, rock: true, idle: 1.4 },
  fire: { id: "fire", model: "shrimp", length: 6, speed: 0.5, range: 0.1, rock: true, idle: 2 },
  harlequin: { id: "harlequin", model: "shrimp", length: 5.5, speed: 0.3, range: 0.14, rock: true, idle: 1.5 },
  pistol: { id: "pistol", model: "shrimp", length: 5.5, speed: 0.6, range: 0.08, burrow: true, idle: 0.8 },
  mantis: { id: "mantis", model: "mantis", length: 11, speed: 0.7, range: 0.14, burrow: true, idle: 1 },
  slipper: { id: "slipper", model: "shrimp", length: 9, speed: 0.25, range: 0.2, depths: [0.15, 0.7], idle: 2.5 },
  hermit: { id: "hermit", model: "hermit", length: 4.5, speed: 0.45, range: 0.22, depths: [0.1, 0.75], idle: 1.2 },
  emerald: { id: "emerald", model: "crab", length: 5.5, speed: 0.45, range: 0.1, rock: true, sideways: true, idle: 1.6 },
  porcelain: { id: "porcelain", model: "crab", length: 3.6, speed: 0.4, range: 0.06, rock: true, sideways: true, idle: 3 },
  arrow: { id: "arrow", model: "crab", length: 8, speed: 0.9, range: 0.14, rock: true, idle: 1.2 },
  swimmer: { id: "swimmer", model: "crab", length: 9, speed: 0.6, range: 0.25, depths: [0.1, 0.7], sideways: true, idle: 1.4 },
};

// lighten mixes a "#rrggbb" hex toward white by amt (0…1).
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) + (255 - (n >> 16)) * amt;
  const g = ((n >> 8) & 0xff) + (255 - ((n >> 8) & 0xff)) * amt;
  const b = (n & 0xff) + (255 - (n & 0xff)) * amt;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// themedPalette rewrites a fish species' body palette when the active theme
// ships a creaturePalette. Themes without one (the default reef-realistic)
// keep every species' own colors, so the classic reef looks unchanged.
function themedPalette(spec: SpeciesSpec): SpeciesColors | undefined {
  if (!spec.colors) return spec.colors;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (globalThis as any).THEME?.creaturePalette as { fish?: string } | undefined;
  if (!p || !p.fish) return spec.colors;
  const fish = p.fish;
  return {
    back: fish,
    flank: lighten(fish, 0.18),
    belly: lighten(fish, 0.38),
    fin: fish,
    iris: spec.colors.iris,
  };
}

// themedSpec returns the species record with theme overrides applied.
function themedSpec(id: string): SpeciesSpec | null {
  const spec = SPECIES[id];
  if (!spec) return null;
  return { ...spec, colors: themedPalette(spec) };
}

// speciesColors exposes the resolved palette for tests and portrait rendering.
export function speciesColors(id: string): SpeciesColors | undefined {
  return themedSpec(id)?.colors;
}

// maxCreatures caps how many species share the tank at once; the visitor
// book still remembers everyone met. reef-realistic sets no cap.
export function maxCreatures(): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).THEME?.behavior?.maxCreatures || 999;
}

// create returns a new creature, or null for an unknown species or one
// whose model is missing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function create(id: string, world: any, options?: { enter?: boolean }): any {
  const spec = themedSpec(id);
  const Model = spec && MODELS[spec.model];
  return Model ? new Model(spec, world, options) : null;
}

// drawPortrait paints a still picture of a species into a canvas for the
// visitor book; unknown species get a plain silhouette.
export function drawPortrait(canvas: HTMLCanvasElement, id: string): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.ceil(w * ratio);
  canvas.height = Math.ceil(h * ratio);
  const c = canvas.getContext("2d");
  if (!c) return;
  c.setTransform(ratio, 0, 0, ratio, 0, 0);
  c.clearRect(0, 0, w, h);
  const spec = themedSpec(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Model = spec && MODELS[spec.model] as any;
  if (Model) {
    Model.portrait(c, spec, w, h);
    return;
  }
  c.fillStyle = "rgba(158,189,189,.35)";
  c.beginPath();
  c.ellipse(w * 0.46, h / 2, w * 0.28, h * 0.2, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(w * 0.7, h / 2);
  c.lineTo(w * 0.86, h * 0.3);
  c.lineTo(w * 0.86, h * 0.7);
  c.fill();
}
