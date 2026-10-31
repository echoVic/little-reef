import { create, maxCreatures } from "./species";
import { clamp, random } from "./engine/motion.js";
import { themeColor, themeMotion } from "../theme/theme";
import type { Snapshot } from "../state/types";

// How far back each planted spot sits, so fish can pass in front of some
// plants and behind others.
const PLANT_DEPTH = [0.55, 0.2, 0.7, 0.35, 0.85, 0.15, 0.6, 0.4];

interface Pellet {
  x: number; y: number; vy?: number; seed: number; z: number; alpha: number;
  eaten?: boolean; landed?: boolean; claimed?: boolean;
}
interface Rock { x: number; y: number; rx: number; ry: number; angle: number; color: string; z: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCreature = any;

export class Reef {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: Snapshot | null = null;
  time = 0;
  last = 0;
  frame: number | null = null;
  creatures = new Map<string, AnyCreature>();
  populated = false;
  newest = "";
  pellets: Pellet[] = [];
  feedUntil = 0;
  nextSwap = 150;
  plants: { x: number; height: number; seed: number; coral: boolean; z: number }[] = [];
  rocks: Rock[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rand: () => number;
  width = 1;
  height = 1;
  sand: [number, number][] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  world: any;
  motion: MediaQueryList;
  nativeReduceMotion = false;
  resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    this.rand = random(20261015);
    this.world = {
      width: 1, height: 1, px: 5, time: 0, still: false, fish: [], pellets: this.pellets, meal: 0, rocks: this.rocks, burrows: {},
      ground: (x: number, z: number) => this.ground(x, z),
      surface: (x: number, z: number) => this.surface(x, z),
      home: (x: number) => this.home(x),
      eat: (pellet: Pellet) => { pellet.eaten = true; },
    };
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.nativeReduceMotion = !!globalThis.mygo?.preferences?.reduceMotion;
    globalThis.mygo?.on("mygo:preferences", (preferences: unknown) => {
      this.nativeReduceMotion = !!(preferences as { reduceMotion?: boolean }).reduceMotion;
      this.schedule();
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", () => this.schedule());
    this.motion.addEventListener("change", () => this.schedule());
    // A palette swap repaints the whole reef, including the canvas.
    addEventListener("theme:changed", () => { this.layout(); this.draw(); });
    this.resize();
    this.schedule();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const oldWidth = this.width || 1, oldHeight = this.height || 1;
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const scale = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.ceil(this.width * scale);
    this.canvas.height = Math.ceil(this.height * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.layout();
    for (const creature of this.creatures.values()) creature.resize(this.width / oldWidth, this.height / oldHeight, this.world);
    for (const p of this.pellets) { p.x *= this.width / oldWidth; p.y *= this.height / oldHeight; if (p.landed) p.y = this.ground(p.x, p.z); }
    if (this.populated) this.arrange(false, this.world.still);
    this.draw();
  }

  // layout measures the sand, rocks and burrows for the current size.
  layout(): void {
    const w = this.width, h = this.height, world = this.world;
    world.width = w; world.height = h;
    world.px = clamp(h / 48, 4.2, 6.5);
    this.sand = [];
    for (let i = 0; i <= 64; i++) {
      const t = i / 64, u = 1 - t;
      this.sand.push([3 * u * u * t * w * 0.4 + 3 * u * t * t * w * 0.62 + t * t * t * w, u * u * u * (h - 17) + 3 * u * u * t * (h - 43) + 3 * u * t * t * (h - 17) + t * t * t * (h - 25)]);
    }
    this.rocks.length = 0;
    this.rocks.push(
      { x: w * 0.81, y: h - 25, rx: 28, ry: 14, angle: -0.15, color: "#6d8179", z: 0.4 },
      { x: w * 0.85, y: h - 20, rx: 17, ry: 10, angle: 0.2, color: "#82948a", z: 0.3 },
      { x: w * 0.45, y: h - 23, rx: 23, ry: 12, angle: 0.1, color: "#6d8179", z: 0.45 },
      { x: w * 0.42, y: h - 19, rx: 14, ry: 9, angle: -0.25, color: "#82948a", z: 0.35 },
    );
    world.burrows.mantis = { x: w * 0.6, z: 0.3 };
    world.burrows.pistol = { x: w * 0.7, z: 0.55 };
    for (const b of Object.values<{ x: number; z: number; y?: number }>(world.burrows)) b.y = this.ground(b.x, b.z);
    this.plantBed();
  }

  // ground is the sand's surface at x; nearer things (smaller z) stand lower.
  ground(x: number, z: number): number {
    const s = this.sand;
    let i = 1;
    while (i < s.length - 1 && s[i][0] < x) i++;
    const [x0, y0] = s[i - 1], [x1, y1] = s[i];
    const top = y0 + (y1 - y0) * clamp((x - x0) / (x1 - x0 || 1), 0, 1);
    return top + (1 - clamp(z, 0, 1)) * clamp((this.height - top) * 0.5, 4, 14);
  }

  // surface is where a crawler at depth z stands: on a rock at its depth, or the sand.
  surface(x: number, z: number): number {
    let y = this.ground(x, z);
    for (const r of this.rocks) {
      if (Math.abs(r.z - z) > 0.16) continue;
      const u = (x - r.x) / (r.rx * 0.9);
      if (Math.abs(u) < 1) y = Math.min(y, r.y - r.ry * 0.92 * Math.sqrt(1 - u * u) + 1);
    }
    return y;
  }

  // plantBed lays out the plants that the completed rounds have grown.
  plantBed(): void {
    const growth = this.state?.completed || 0, w = this.width;
    this.plants = [];
    if (growth <= 0) return;
    const count = Math.min(8, 1 + Math.floor((growth - 1) / 3));
    for (let i = 0; i < count; i++) {
      const progress = Math.min(3, Math.max(1, growth - i * 3));
      this.plants.push({ x: w * (0.09 + ((i * 0.137) % 0.71)), height: 28 + progress * 18, seed: i, coral: i > 0 && i % 3 === 0, z: PLANT_DEPTH[i] });
    }
  }

  // home is where the clownfish lives: the nearest plant, or a spot beside the nearest rock.
  home(x: number): { x: number; y: number } {
    let best: { x: number; height: number } | null = null;
    for (const p of this.plants) if (!best || Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    if (best) return { x: best.x, y: this.height - 25 - best.height * 0.55 };
    let rock: Rock | null = null;
    for (const r of this.rocks) if (!rock || Math.abs(r.x - x) < Math.abs(rock.x - x)) rock = r;
    return { x: (rock as Rock).x - 20, y: this.height - 70 };
  }

  update(state: Snapshot): void {
    const oldFed = this.state?.fedSession;
    this.state = state;
    this.plantBed();
    this.populate();
    if (oldFed !== undefined && state.fedSession !== oldFed && state.fedSession && !this.world.still) this.feed();
    this.draw();
  }

  // populate adds a creature for the resident and every visitor met so far.
  populate(): void {
    const visitors = (this.state?.visitors || []).slice(0, maxCreatures() - 1);
    const enter = this.populated && !this.world.still;
    for (const id of ["resident", ...visitors.map(v => v.species)]) {
      if (this.creatures.has(id)) continue;
      const creature = create(id, this.world, { enter });
      if (creature) this.creatures.set(id, creature);
    }
    let newest: { date: string; species: string } | null = null;
    for (const v of visitors) if (!newest || v.date > newest.date) newest = v;
    this.newest = newest?.species || "";
    this.arrange(false, !this.populated || this.world.still);
    this.populated = true;
  }

  // arrange keeps a few crawlers out and the rest resting at home.
  arrange(swap: boolean, instant: boolean): void {
    const crawlers = [...this.creatures.values()].filter((c: AnyCreature) => c.crawler);
    if (!crawlers.length) return;
    const limit = clamp(Math.floor(this.width / 120), 3, 5);
    const newest = this.creatures.get(this.newest);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let out = crawlers.filter((c: any) => c.active) as AnyCreature[];
    let resting: AnyCreature | null = null;
    if (swap && crawlers.length > limit) {
      const leaving = out.filter(c => c !== newest);
      if (leaving.length) { resting = leaving[Math.floor(this.rand() * leaving.length)]; resting.setActive(false, this.world, instant); out = out.filter(c => c !== resting); }
    }
    if (newest?.crawler && !newest.active) { newest.setActive(true, this.world, instant); out.push(newest); }
    while (out.length > limit) { const c = out.find(o => o !== newest); c.setActive(false, this.world, instant); out = out.filter(o => o !== c); }
    const waiting = crawlers.filter(c => !c.active && c !== resting);
    while (out.length < limit && waiting.length) {
      const room = (c: AnyCreature) => Math.min(Infinity, ...out.map(o => Math.abs(o.home.x - c.home.x))) + this.rand() * this.width * 0.15;
      waiting.sort((a, b) => room(b) - room(a));
      const c = waiting.shift(); c.setActive(true, this.world, instant); out.push(c);
    }
  }

  // feed scatters pellets near the surface; they sink slowly and drift.
  feed(): void {
    const r = this.rand, x = this.width * (0.3 + r() * 0.4);
    this.pellets.length = 0;
    for (let i = 0; i < 12; i++) this.pellets.push({ x: x + (r() - 0.5) * this.width * 0.16, y: this.height * (0.03 + r() * 0.06), vy: this.height * (0.06 + r() * 0.03), seed: r() * 9, z: 0.15 + r() * 0.5, alpha: 1 });
    this.feedUntil = this.time + 20;
    this.world.meal++;
  }

  get reducedMotion(): boolean { return this.motion.matches || this.nativeReduceMotion; }

  schedule(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    const was = this.world.still; this.world.still = this.reducedMotion;
    if (this.world.still && !was && this.populated) { this.pellets.length = 0; this.creatures.clear(); this.rand = random(20261015); this.populated = false; this.populate(); }
    if (document.hidden || this.reducedMotion) { this.draw(); return; }
    this.last = 0;
    const animate = (now: number) => {
      this.frame = requestAnimationFrame(animate);
      if (this.last && now - this.last < 1000 / 24) return;
      const delta = this.last ? Math.min((now - this.last) / 1000, 0.15) : 0;
      this.last = now;
      this.time += delta;
      this.step(delta);
      this.draw();
    };
    this.frame = requestAnimationFrame(animate);
  }

  step(dt: number): void {
    const world = this.world;
    world.time = this.time;
    world.fish.length = 0;
    for (const c of this.creatures.values()) if (!c.crawler) world.fish.push(c);
    if (this.time > this.nextSwap) { this.nextSwap = this.time + 120 + this.rand() * 120; this.arrange(true, false); }
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const p = this.pellets[i];
      if (p.eaten || p.alpha <= 0) { this.pellets.splice(i, 1); continue; }
      if (!p.landed) {
        p.y += (p.vy as number) * dt; p.x += Math.sin(this.time * 1.3 + p.seed) * 5 * dt;
        const floor = this.ground(p.x, p.z);
        if (p.y >= floor) { p.y = floor; p.landed = true; }
      }
      if (this.time > this.feedUntil) p.alpha -= dt;
    }
    for (const c of this.creatures.values()) c.step(dt, world);
  }

  plant(x: number, height: number, seed: number, coral = false): void {
    const c = this.ctx, h = this.height;
    const sway = Math.sin(this.time * 0.5 + seed) * 5;
    c.save(); c.translate(x, h - 25);
    c.lineCap = "round";
    if (coral) {
      c.strokeStyle = themeColor("coral", "#bd918c"); c.lineWidth = 4;
      for (let i = 0; i < 5; i++) {
        const side = i % 2 ? 1 : -1, y = -height * (0.3 + i * 0.14);
        c.beginPath(); c.moveTo(0, 2); c.quadraticCurveTo(sway / 3, -height / 2, sway, -height); c.stroke();
        c.beginPath(); c.moveTo(sway * 0.3, y + 12); c.quadraticCurveTo(side * 15, y, side * 18, y - 18); c.stroke();
      }
    } else {
      c.strokeStyle = seed % 2 ? themeColor("seaweed", "#529a86") : "#70af91"; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-8, -height / 3, 10 + sway, -height * 0.7, sway, -height); c.stroke();
      for (let i = 0; i < 4; i++) {
        const y = -height * (0.2 + i * 0.19), side = i % 2 ? 1 : -1;
        c.fillStyle = i % 2 ? "#79b89b" : "#568d7c";
        c.beginPath(); c.moveTo(sway * 0.2, y); c.quadraticCurveTo(side * 25, y - 3, side * 16 + sway, y - 22); c.quadraticCurveTo(side * 2, y - 17, sway * 0.2, y); c.fill();
      }
    }
    c.restore();
  }

  rock(r: Rock): void {
    const c = this.ctx;
    c.fillStyle = r.color; c.beginPath(); c.ellipse(r.x, r.y, r.rx, r.ry, r.angle, 0, Math.PI * 2); c.fill();
  }

  draw(): void {
    if (!this.ctx) return;
    const c = this.ctx, w = this.width, h = this.height, t = this.time;
    c.clearRect(0, 0, w, h);
    c.fillStyle = themeColor("bubble", "#b4cfb1") + "14";
    const bubbleCount = Math.round(18 * themeMotion("bubbleDensity"));
    for (let i = 0; i < bubbleCount; i++) {
      const y = h - ((t * (7 + i % 3) + i * 27) % (h + 30));
      const x = (i * 43 + 21) % w + Math.sin(t * 0.2 + i) * 8;
      c.beginPath(); c.arc(x, y, 1 + i % 2, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = "#53675a"; c.beginPath(); c.moveTo(0, h);
    c.lineTo(0, h - 28); c.bezierCurveTo(w * 0.25, h - 53, w * 0.7, h - 7, w, h - 34); c.lineTo(w, h); c.fill();
    c.fillStyle = themeColor("sand", "#718371"); c.beginPath(); c.moveTo(0, h); c.lineTo(0, h - 17); c.bezierCurveTo(w * 0.4, h - 43, w * 0.62, h - 17, w, h - 25); c.lineTo(w, h); c.fill();
    for (let i = 0; i < 25; i++) { c.fillStyle = i % 2 ? "#899781" : "#566c5e"; c.beginPath(); c.ellipse((i * 71 + 14) % w, h - 8 - i % 19, 1.5, 1, 0, 0, Math.PI * 2); c.fill(); }
    if ((this.state?.completed || 0) >= 24) { c.fillStyle = themeColor("accent", "#a8deba") + "08"; c.fillRect(0, 0, w, h); }
    for (const creature of this.creatures.values()) creature.under?.(c, this.world);
    const scene: [number, number, unknown][] = [];
    for (const r of this.rocks) scene.push([r.z, 0, r]);
    for (const p of this.plants) scene.push([p.z, 1, p]);
    for (const creature of this.creatures.values()) scene.push([creature.z, 2, creature]);
    scene.sort((a, b) => b[0] - a[0]);
    for (const [, kind, item] of scene) {
      if (kind === 0) this.rock(item as Rock);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      else if (kind === 1) { const p = item as any; this.plant(p.x, p.height, p.seed, p.coral); }
      else (item as AnyCreature).draw(c, this.world);
    }
    for (const p of this.pellets) {
      const r = 1.7 * (1 - 0.3 * p.z);
      c.fillStyle = `${themeColor("coral", "#e2c294")}${Math.round(p.alpha * 255).toString(16).padStart(2, "0")}`; c.beginPath(); c.arc(p.x, p.y - r * 0.6, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = `rgba(255,240,214,${0.6 * p.alpha})`; c.beginPath(); c.arc(p.x - r * 0.3, p.y - r, r * 0.4, 0, Math.PI * 2); c.fill();
    }
  }
}
