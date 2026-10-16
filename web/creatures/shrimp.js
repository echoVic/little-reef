import { curve, dot, hole, limb, lip, oval, shade, shadow, tone, wind } from "./paint.js";
import { Crawler, Gait, TAU, clamp, follow, knee, lerp, noise } from "./motion.js";

// Shrimp are drawn facing right in units of body length, standing on the
// ground at y = 0 with the carapace raised on their legs. The abdomen is a
// chain of six segments that arches over the back and curls under for an
// escape flip; the tail fan opens at its end.
const SHAPES = {
  // Lysmata and its relatives: a slim body with a hump in the abdomen.
  slim: {
    carapace: [[.42, -.215], [.34, -.275], [.2, -.3], [.06, -.29], [-.01, -.255], [-.02, -.17], [.06, -.135], [.2, -.128], [.33, -.142], [.41, -.18]],
    rostrum: [[.36, -.258], [.53, -.282], [.4, -.225]],
    waist: [0, -.215], segments: [[.085, .16], [.08, .165], [.075, .15], [.07, .13], [.065, .105], [.075, .08]],
    arch: [.3, .1, -.3, -.34, -.24, -.12], fan: .12,
    hips: [[.34, -.14], [.28, -.135], [.21, -.13], [.14, -.13], [.07, -.135]], rests: [.44, .32, .2, .09, -.02], upper: .085, lower: .1,
    eye: [.38, -.25, .034], antenna: [.39, -.22], mouth: [.43, -.15],
  },
  // The harlequin shrimp is short and deep, carrying two flat claws.
  stocky: {
    carapace: [[.38, -.2], [.32, -.29], [.18, -.32], [.04, -.3], [-.02, -.26], [-.03, -.15], [.06, -.12], [.2, -.115], [.32, -.13], [.38, -.16]],
    rostrum: [[.33, -.25], [.43, -.27], [.36, -.22]],
    waist: [-.01, -.215], segments: [[.08, .19], [.075, .19], [.07, .17], [.065, .145], [.06, .115], [.065, .09]],
    arch: [.24, .08, -.26, -.3, -.24, -.12], fan: .11,
    hips: [[.31, -.125], [.25, -.12], [.18, -.115], [.11, -.115], [.04, -.12]], rests: [.4, .29, .18, .07, -.04], upper: .075, lower: .085,
    eye: [.35, -.24, .032], antenna: [.36, -.21], mouth: [.4, -.14],
  },
  // The pistol shrimp is stockier, with its eyes under a hood.
  stout: {
    carapace: [[.4, -.2], [.33, -.26], [.2, -.28], [.06, -.27], [-.01, -.24], [-.02, -.15], [.06, -.12], [.2, -.115], [.32, -.13], [.4, -.165]],
    rostrum: [[.36, -.235], [.44, -.24], [.38, -.205]],
    waist: [0, -.2], segments: [[.08, .15], [.08, .155], [.075, .15], [.07, .135], [.065, .115], [.07, .09]],
    arch: [.22, .06, -.22, -.26, -.2, -.1], fan: .11,
    hips: [[.32, -.125], [.26, -.12], [.2, -.115], [.13, -.115], [.06, -.12]], rests: [.42, .31, .19, .08, -.03], upper: .08, lower: .09,
    eye: [.37, -.215, .026], antenna: [.38, -.2], mouth: [.42, -.14],
  },
  // The slipper lobster is flat and drawn a little from above (see paintSlipper);
  // only its legs use this side-view layout.
  flat: {
    hips: [[.3, -.04], [.22, -.04], [.14, -.04], [.06, -.04], [-.02, -.04]], rests: [.34, .25, .16, .07, -.02], upper: .04, lower: .045,
    mouth: [.4, -.06],
  },
};

const LOOKS = {
  cleaner: { shape: "slim", whip: 2.3, colors: { body: "#f1b744", belly: "#e7a53b", band: "#c7302a", stripe: "#f7f2e8", leg: "#efe6d8", fan: "#c7302a", whip: "#f4efe6" } },
  fire: { shape: "slim", whip: 2, colors: { body: "#b81e25", belly: "#a11a20", band: "#b81e25", leg: "#f1e9de", fan: "#b81e25", whip: "#f4efe6", spots: "#f7efe5" } },
  harlequin: { shape: "stocky", whip: .3, colors: { body: "#f3ebdc", belly: "#e8dccb", leg: "#efe3d6", fan: "#f1e6d6", whip: "#ead9c9", patch: "#c64c86", edge: "#6d2f62" } },
  pistol: { shape: "stout", whip: .9, colors: { body: "#ecdfc6", belly: "#dcc9aa", leg: "#e6c7a0", fan: "#e3cfb1", whip: "#d58a52", patch: "#b4642c" } },
  slipper: { shape: "flat", whip: 0, colors: { body: "#a58260", belly: "#8a6a4c", leg: "#8a6a4c", fan: "#9b7a58", patch: "#5f4734", plate: "#9a7856" } },
};

// pose lays out the abdomen chain for a given curl (0 relaxed … 1 tucked).
function chain(shape, curl) {
  const out = [];
  let [x, y] = shape.waist, a = Math.PI;
  shape.segments.forEach(([len, h], i) => {
    a += shape.arch[i] - curl * (.22 + i * .07);
    const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
    out.push({ x, y, nx, ny, a, h, ux: -Math.sin(a), uy: Math.cos(a) });
    x = nx; y = ny;
  });
  return out;
}

// paintShrimp draws a shrimp in unit space. pose has the feet in unit
// coordinates, the curl, antenna angles and the claws' work.
function paintShrimp(c, id, pose, haze, L) {
  const look = LOOKS[id], shape = SHAPES[look.shape], C = look.colors, hair = 1 / L, col = shade(haze);
  if (id === "slipper") { paintSlipper(c, pose, col, C, hair); return; }
  const segs = chain(shape, pose.curl);
  const tail = segs[segs.length - 1];
  // Far side first: the far antenna and legs, darker and a little higher.
  if (look.whip) whip(c, shape.antenna, pose.whip2, look.whip * .95, col(C.whip, .55, -.25), hair * .7);
  legs(c, shape, pose.far, col(C.leg, .75, -.35), hair * 1.2);
  // Swimmerets beat under the abdomen.
  c.strokeStyle = col(C.leg, .7, -.1); c.lineCap = "round"; c.lineWidth = hair * 1.4;
  segs.slice(0, 5).forEach((s, i) => {
    const mx = (s.x + s.nx) / 2 - s.ux * s.h * .45, my = (s.y + s.ny) / 2 - s.uy * s.h * .45, swing = Math.sin(pose.paddle - i * .8) * .5;
    c.beginPath(); c.moveTo(mx, my); c.lineTo(mx - s.ux * .07 + Math.cos(s.a + swing) * .03, my - s.uy * .07 + Math.sin(s.a + swing) * .03); c.stroke();
  });
  // Tail fan: the telson with a uropod on each side.
  const fanA = tail.a + .05, open = shape.fan * (1 + pose.curl * .3);
  for (const [da, len, w] of [[.32 + pose.curl * .3, 1, .38], [-.3 - pose.curl * .3, 1, .38], [0, 1.05, .28]]) {
    c.fillStyle = col(C.fan, .82, da ? 0 : -.1);
    oval(c, tail.nx + Math.cos(fanA + da) * open * len * .5, tail.ny + Math.sin(fanA + da) * open * len * .5, open * len * .55, open * w * .5, fanA + da);
  }
  // Body: carapace and abdomen as one shape, so markings run across them.
  const body = new Path2D();
  curve(body, wind(shape.carapace), true);
  if (shape.rostrum) curve(body, wind(shape.rostrum), true);
  const top = segs.map(s => [s.x + s.ux * s.h / 2, s.y + s.uy * s.h / 2]), under = [];
  for (const s of segs) under.push([s.x - s.ux * s.h / 2, s.y - s.uy * s.h / 2], [(s.x + s.nx) / 2 - s.ux * s.h * .58, (s.y + s.ny) / 2 - s.uy * s.h * .58]);
  top.push([tail.nx + tail.ux * tail.h * .42, tail.ny + tail.uy * tail.h * .42]); under.push([tail.nx - tail.ux * tail.h * .42, tail.ny - tail.uy * tail.h * .42]);
  curve(body, wind([...top, ...under.reverse()]), true);
  const g = c.createLinearGradient(0, -.33, 0, -.1);
  g.addColorStop(0, col(C.body, .96, .06)); g.addColorStop(1, col(C.belly, .92, -.05));
  c.fillStyle = g; c.fill(body);
  c.save(); c.clip(body);
  const back = [[.4, -.27], [.2, -.31], [.04, -.29], ...segs.map(s => [s.nx + s.ux * s.h * .38, s.ny + s.uy * s.h * .38])];
  if (C.band !== C.body && C.band) {
    c.strokeStyle = col(C.band); c.lineWidth = .1; c.lineJoin = "round"; c.beginPath(); curve(c, back.map(([x, y]) => [x, y + .02])); c.stroke();
    c.strokeStyle = col(C.stripe); c.lineWidth = .02; c.beginPath(); curve(c, back.map(([x, y]) => [x, y + .012])); c.stroke();
  }
  if (C.spots) { c.fillStyle = col(C.spots, .9); for (const [x, y, r] of [[.3, -.23, .014], [.22, -.2, .01], [.14, -.24, .012], [.06, -.19, .011], [.25, -.16, .009]]) dot(c, x, y, r); for (const s of segs) dot(c, (s.x + s.nx) / 2 + s.ux * .02, (s.y + s.ny) / 2 + s.uy * .02, .012); }
  if (id === "harlequin") {
    for (const [x, y, r] of [[.3, -.22, .045], [.13, -.24, .05], ...segs.filter((_, i) => i % 2 === 0).map(s => [(s.x + s.nx) / 2, (s.y + s.ny) / 2, .045])]) {
      c.fillStyle = col(C.edge, .9); dot(c, x, y, r + .012); c.fillStyle = col(C.patch); dot(c, x, y, r);
    }
  }
  if (id === "pistol") { c.fillStyle = col(C.patch, .85); for (const s of segs) oval(c, (s.x + s.nx) / 2 + s.ux * .02, (s.y + s.ny) / 2 + s.uy * .02, .03, .05, s.a); oval(c, .2, -.22, .07, .04, -.1); oval(c, .06, -.2, .04, .05); }
  // Joints between segments and the light from above.
  c.strokeStyle = col(C.body, .4, -.45); c.lineWidth = hair * .8;
  for (const s of segs) { c.beginPath(); c.moveTo(s.x + s.ux * s.h * .55, s.y + s.uy * s.h * .55); c.quadraticCurveTo(s.x + Math.cos(s.a) * .015, s.y + Math.sin(s.a) * .015, s.x - s.ux * s.h * .6, s.y - s.uy * s.h * .6); c.stroke(); }
  const light = c.createLinearGradient(0, -.33, 0, -.08);
  light.addColorStop(0, `rgba(255,255,255,${.3 * (1 - haze)})`); light.addColorStop(.45, "rgba(255,255,255,0)"); light.addColorStop(1, "rgba(0,18,24,.25)");
  c.fillStyle = light; c.fillRect(-.6, -.4, 1.2, .4);
  c.restore();
  // Near legs, claws, antennae and the eye.
  legs(c, shape, pose.near, col(C.leg, .78), hair * 1.35);
  if (id === "harlequin") petals(c, pose, col, C);
  if (id === "pistol") snapper(c, pose, col, C, hair);
  if (shape.antenna) {
    const [ax, ay] = shape.antenna;
    c.strokeStyle = col(C.whip, .9); c.lineWidth = hair * .9;
    for (const lift of [-.5, -.75]) { c.beginPath(); c.moveTo(ax + .01, ay - .02); c.quadraticCurveTo(ax + .1, ay - .08 + lift * .05, ax + .17, ay - .07 + lift * .12 + Math.sin(pose.paddle * .7 + lift) * .02); c.stroke(); }
    if (look.whip) whip(c, shape.antenna, pose.whip, look.whip, col(C.whip, .9), hair * .9);
  }
  const [ex, ey, er] = shape.eye;
  c.strokeStyle = col(C.body, .9, -.2); c.lineWidth = er * .9; c.beginPath(); c.moveTo(ex - .04, ey + .01); c.lineTo(ex, ey); c.stroke();
  c.fillStyle = col("#0d0a09", .95); dot(c, ex, ey, er);
  c.fillStyle = `rgba(255,255,255,${.75 * (1 - haze)})`; dot(c, ex + er * .3, ey - er * .35, er * .3);
  if (id === "pistol") { c.fillStyle = col(C.body, .45, .15); oval(c, ex - .004, ey - .012, er * 1.5, er * 1.15); }
}

// whip draws a long antenna that arcs forward and droops toward its tip.
function whip(c, [ax, ay], angle, length, color, width) {
  const tx = ax + Math.cos(angle) * length, ty = ay + Math.sin(angle) * length * .55 + length * .12;
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = "round";
  c.beginPath(); c.moveTo(ax, ay); c.bezierCurveTo(ax + Math.cos(angle - .35) * length * .35, ay + Math.sin(angle - .35) * length * .35, ax + Math.cos(angle - .1) * length * .7, ay + Math.sin(angle - .1) * length * .6, tx, ty); c.stroke();
}

// legs draws walking legs from their hips to the feet, knees raised.
function legs(c, shape, feet, color, width) {
  feet.forEach(([fx, fy], i) => {
    const [hx, hy] = shape.hips[i], [kx, ky] = knee(hx, hy, fx, fy, shape.upper, shape.lower);
    limb(c, [[hx, hy], [kx, ky], [fx, fy]], width, width * .7, color);
  });
}

// petals are the harlequin shrimp's flat, spotted claws held up in front.
function petals(c, pose, col, C) {
  for (const [dx, lift] of [[0, 0], [.03, .05]]) {
    c.save(); c.translate(.38 + dx, -.16); c.rotate(-.9 - lift + Math.sin(pose.paddle * .3) * .05 - pose.work * .3);
    c.fillStyle = col(C.body, .95, .05); oval(c, .14, 0, .14, .06);
    c.fillStyle = col(C.edge, .9); dot(c, .12, 0, .035); c.fillStyle = col(C.patch); dot(c, .12, 0, .026);
    c.fillStyle = col(C.edge, .9); dot(c, .22, .01, .02); c.fillStyle = col(C.patch); dot(c, .22, .01, .014);
    c.restore();
  }
}

// snapper is the pistol shrimp's big claw; its finger snaps shut.
function snapper(c, pose, col, C, hair) {
  c.save(); c.translate(.4, -.13); c.rotate(-.15 - pose.work * .25);
  limb(c, [[-.06, -.01], [.04, .02]], hair * 3, hair * 3, col(C.leg));
  c.fillStyle = col("#c9733a"); oval(c, .14, .01, .11, .05, -.05);
  c.fillStyle = col(C.patch, .9, -.15); oval(c, .12, .02, .05, .02);
  c.save(); c.translate(.24, -.01); c.rotate(-.5 * pose.open);
  c.fillStyle = col("#c9733a", 1, -.08); oval(c, .05, 0, .055, .018);
  c.restore();
  c.fillStyle = `rgba(255,255,255,${.25 * (1 - pose.haze)})`; oval(c, .13, -.015, .06, .012, -.05);
  c.restore();
}

// paintSlipper draws the slipper lobster from a little above: a broad flat
// shell shaped like a pipa, two shovel plates in front and a wide tail fan.
// The outline is laid out as seen from straight above (u along the body, v
// across it), squashed to the viewing angle, with its side showing below.
function paintSlipper(c, pose, col, C, hair) {
  const squash = .55, high = -.1;
  const plan = [[.4, -.04], [.4, -.2], [.36, -.255], [.28, -.27], [.14, -.255], [.02, -.225], [-.08, -.18], [-.2, -.155], [-.31, -.13], [-.39, -.11], [-.43, -.14], [-.5, -.2], [-.56, -.12], [-.58, -.04], [-.56, 0]];
  const outline = [...plan, ...plan.slice(0, -1).reverse().map(([u, v]) => [u, -v])];
  const place = (pts, dy = 0) => pts.map(([u, v]) => [u, high + v * squash + dy]);
  // Short legs poke out from under the shell.
  legs(c, SHAPES.flat, pose.far, col(C.leg, .7, -.3), hair * 1.3);
  // The side of the shell, then its top.
  c.fillStyle = col(C.belly, 1, -.25); c.fill(curve(new Path2D(), place(outline, .035), true));
  const top = curve(new Path2D(), place(outline), true);
  const g = c.createLinearGradient(0, high - .09, 0, high + .09);
  g.addColorStop(0, col(C.body, 1, .1)); g.addColorStop(1, col(C.body, 1, -.12));
  c.fillStyle = g; c.fill(top);
  c.save(); c.clip(top);
  c.fillStyle = col(C.patch, .5);
  for (const [u, v, r] of [[.25, -.13, .035], [.2, .1, .03], [.06, -.05, .04], [.3, .16, .028], [-.1, .09, .03], [-.2, -.07, .03], [-.3, .05, .025], [.12, .17, .022], [.34, -.03, .025]]) oval(c, u, high + v * squash, r, r * squash * 1.3);
  c.fillStyle = col("#e3cfae", .5);
  for (let i = 0; i < 18; i++) dot(c, .36 - (i * .029) % .42, high + ((i * 37) % 23 / 23 - .5) * .36 * squash, .007);
  // The carapace's rim and the abdomen's segment lines.
  c.strokeStyle = col(C.patch, .5); c.lineWidth = hair;
  c.beginPath(); curve(c, place([[.36, -.25], [.14, -.2], [.0, -.14], [-.03, 0], [.0, .14], [.14, .2], [.36, .25]])); c.stroke();
  for (const u of [-.1, -.18, -.26, -.34]) { c.beginPath(); curve(c, place([[u + .015, -.15], [u - .015, 0], [u + .015, .15]])); c.stroke(); }
  c.strokeStyle = col("#ead8b8", .4); c.lineWidth = hair * 1.4; c.beginPath(); curve(c, place([[.36, -.02], [.1, -.03], [-.36, -.015]])); c.stroke();
  c.restore();
  // The two shovel plates in front, with toothed edges.
  for (const side of [-1, 1]) {
    const plate = [[.39, side * .015], [.48, side * .02], [.56, side * .06], [.53, side * .1], [.57, side * .15], [.52, side * .22], [.45, side * .26], [.39, side * .24]];
    c.fillStyle = col(C.belly, 1, -.25); c.fill(curve(new Path2D(), place(plate, .03), true));
    c.fillStyle = col(C.plate, 1, side < 0 ? .08 : -.04); c.fill(curve(new Path2D(), place(plate), true));
    c.strokeStyle = col(C.patch, .55); c.lineWidth = hair; c.beginPath(); curve(c, place([[.41, side * .06], [.5, side * .12], [.52, side * .2]])); c.stroke();
  }
  // Eyes sit at the front corners of the shell.
  for (const side of [-1, 1]) { const [x, y] = place([[.37, side * .245]])[0]; c.fillStyle = col("#120d0a", .95); dot(c, x, y - .012, .02); c.fillStyle = "rgba(255,255,255,.6)"; dot(c, x + .006, y - .018, .007); }
  legs(c, SHAPES.flat, pose.near, col(C.leg, .9, -.1), hair * 1.5);
}

// Shrimp walk on legs that keep their footing, sway their antennae, beat
// their swimmerets, and flip backward with their tails when startled.
export class Shrimp extends Crawler {
  constructor(spec, world, options) {
    super(spec, world, options);
    const shape = SHAPES[LOOKS[spec.id].shape];
    this.legs = new Gait([...shape.rests.map((dx, i) => ({ dx, group: i % 2 })), ...shape.rests.map((dx, i) => ({ dx: dx - .05, group: 1 - i % 2, dz: .06 }))], { stride: .22, lift: .06, duration: .16 });
    this.curl = 0; this.dart = 0; this.hop = 0; this.whip = -.75; this.paddle = 0; this.work = 0; this.open = 0; this.snap = 0; this.buried = 0;
    this.carry = 0; this.piles = [];
  }

  settle(world) {
    super.settle(world);
    if (this.spec.burrow) { const b = world.burrows[this.spec.id]; this.home = this.den = { x: b.x, z: b.z }; this.depths = [Math.max(0, b.z - .1), b.z + .1]; this.hides = true; this.burrow = b; }
  }

  // The slipper lobster digs in where it rests instead of hiding.
  get resting() { return this.state === "in" && !this.hides; }

  startle(world) {
    // Burrowers and the shy fire shrimp go home for a while; the others flip away.
    if (this.spec.burrow || this.spec.id === "fire") { this.hideAway(8 + this.rand() * 10); return; }
    if (this.spec.id === "harlequin") { super.startle(world); return; }
    this.dart = 1; this.goal = null; this.until = world.time + 3;
    this.vx = -this.facing * this.size(world) * 7;
  }

  step(dt, world) {
    const L = this.size(world);
    if (this.dart > 0) {
      // Escape flip: the tail snaps under and the body darts backward.
      this.dart = Math.max(0, this.dart - dt * 2.2); this.busy = this.dart > 0;
      this.curl = Math.sin(Math.PI * Math.min(1, (1 - this.dart) * 1.6));
      this.hop = Math.sin(Math.PI * (1 - this.dart)) * L * .35;
      this.vx = follow(this.vx, 0, 3, dt);
      this.x = clamp(this.x, world.width * .02, world.width * .98);
    } else { this.busy = false; this.curl = follow(this.curl, 0, 6, dt); this.hop = 0; }
    this.routine(dt, world);
    if (this.dart > 0) this.legs.place(this.x, this.legScale(world), this.footing(world));
    else this.legs.update(dt, this.x, this.legScale(world), this.footing(world), this.vx);
    // Antennae trail the body a little and wave on their own; cleaners wave more.
    const wave = this.spec.id === "cleaner" ? .22 : .1;
    this.whip = follow(this.whip, -.7 + noise(this.seed, this.clock * .6) * wave - clamp(this.vx * this.facing / L, -1, 1) * .25, 5, dt);
    this.paddle += TAU * (this.state === "in" ? 1.2 : 2.4) * dt;
    this.work = this.eating > 0 ? .5 + Math.sin(this.clock * 9) * .5 : follow(this.work, 0, 4, dt);
    this.buried = follow(this.buried, this.resting ? 1 : 0, 1.2, dt);
    if (this.spec.id === "pistol") {
      // It bulldozes sand out of its burrow: carried in front of the claws on
      // the way out, dropped in a little heap where it stops.
      const b = this.burrow, outward = this.state === "out" && this.goal && !this.goal.food && Math.abs(this.goal.x - b.x) > Math.abs(this.x - b.x);
      if (this.carry > .6 && !outward && this.state === "out") { this.piles.push({ x: this.x + this.facing * L * .6, z: this.z, life: 1 }); this.carry = 0; }
      this.carry = follow(this.carry, outward ? 1 : 0, 2, dt);
      for (const p of this.piles) p.life -= dt / 12;
      this.piles = this.piles.filter(p => p.life > 0);
      if (this.state === "out" && !this.goal && this.rand() < dt * .08) this.snap = 1;
      this.snap = Math.max(0, this.snap - dt * 2.5);
      this.open = this.snap > .85 ? 1 : follow(this.open, this.snap > 0 ? 0 : .35, 12, dt);
    }
  }

  under(c, world) {
    if (!this.burrow) return;
    const b = this.burrow, r = this.spec.length * world.px * .55;
    hole(c, b.x, world.ground(b.x, b.z), r);
    for (const p of this.piles) { c.fillStyle = tone("#8f9d86", p.z * .5, p.life); oval(c, p.x, world.ground(p.x, p.z), r * .5, r * .2); }
  }

  draw(c, world) {
    if (this.hidden && !this.burrow) return;
    const L = this.size(world), haze = this.z * .5;
    const lift = this.hop + this.legs.airborne * L * .015;
    let sink = 0;
    if (this.burrow) {
      // Going home means backing down into the burrow, a little at a time.
      const b = this.burrow, near = 1 - clamp(Math.abs(this.x - b.x) / (L * .6), 0, 1);
      sink = this.state === "in" ? 1 - .35 * Math.max(0, noise(this.seed + 4, this.clock * .2)) : this.state === "leaving" ? near : 0;
      if (sink > .98) return;
    }
    if (this.buried > .01) sink = Math.max(sink, this.buried * .5);
    shadow(c, this.x, this.y + 1, L * .45, L * .1, .3 * (1 - sink) * this.shown * (1 - haze));
    c.save();
    c.globalAlpha = this.shown;
    c.translate(this.x, this.y - lift + sink * L * .32);
    if (sink > 0) { c.beginPath(); c.rect(-L * 3, -L * 3, L * 6, L * 3 - sink * L * .32 + 1); c.clip(); }
    c.scale(this.flipX * L, L);
    const feet = this.localFeet(L, lift);
    if (this.eating > 0 || this.work > .05) { const m = SHAPES[LOOKS[this.spec.id].shape].mouth; feet[0] = [lerp(feet[0][0], m[0] + .04, this.work), lerp(feet[0][1], m[1] + .02, this.work)]; }
    paintShrimp(c, this.spec.id, { near: feet.slice(0, 5), far: feet.slice(5), curl: this.curl, whip: this.whip, whip2: this.whip - .12, paddle: this.paddle, work: this.work, open: this.open, haze }, haze, L);
    c.restore();
    if (this.carry > .05) { c.fillStyle = tone("#8f9d86", haze, this.shown); oval(c, this.x + this.facing * L * .62, this.y - L * .035, L * .1 * this.carry, L * .055 * this.carry); }
    if (this.snap > .6) { c.fillStyle = `rgba(235,250,255,${(this.snap - .6) * 2})`; c.beginPath(); c.arc(this.x + this.facing * L * .7, this.y - L * .16, L * .08 + (1 - this.snap) * L * .3, 0, TAU); c.fill(); }
    if (this.burrow) { const b = this.burrow, r = this.spec.length * world.px * .55; lip(c, b.x, world.ground(b.x, b.z), r); }
    if (this.buried > .01) { c.fillStyle = tone("#718371", haze, this.buried); c.beginPath(); c.ellipse(this.x, this.y + 1, L * .6, L * .08, 0, 0, TAU); c.fill(); }
  }

  static portrait(c, spec, w, h) {
    const look = LOOKS[spec.id], shape = SHAPES[look.shape];
    const reach = look.whip ? .55 + look.whip * .15 : .55, L = Math.min(w * .92 / (.55 + reach), h * .82 / .42);
    c.save(); c.translate(w / 2 - (reach - .55) / 2 * L, h * .82); c.scale(L, L);
    const feet = shape.rests.map(dx => [dx, 0]);
    paintShrimp(c, spec.id, { near: feet, far: feet.map(([x, y]) => [x - .05, y - .015]), curl: 0, whip: -.62, whip2: -.75, paddle: 1, work: 0, open: .3, haze: 0 }, 0, L);
    c.restore();
  }
}
