import { dot, limb, oval, shade, shadow } from "./paint.js";
import { Crawler, Gait, clamp, follow, knee, noise } from "./motion.js";

// The hermit crab is drawn facing right in units of its length, standing on
// the ground at y = 0. Its borrowed snail shell rides on its back with the
// opening toward the front; legs, claws and eyes come out of the opening and
// pull back inside when it hides.
const C = { shell: "#cdb495", band: "#8c6a4c", lip: "#e8d9c0", inside: "#2a1c16", leg: "#c3302a", joint: "#e6a24a", eye: "#e5c34b" };
const HIPS = [[.22, -.14], [.15, -.12]];
const RESTS = [.42, .27];

// paintHermit draws the crab for a pose: out is how far it has come out of
// its shell (0 inside … 1 out), feet are in unit coordinates.
function paintHermit(c, pose, haze, L) {
  const col = shade(haze), hair = 1 / L, out = pose.out;
  // Far legs behind the shell.
  if (out > .05) for (const [i, [fx, fy]] of pose.far.entries()) {
    const [hx, hy] = HIPS[i], [kx, ky] = knee(hx - .02, hy - .01, fx, fy, .15 * out + .02, .17 * out + .02);
    limb(c, [[hx - .02, hy - .01], [kx, ky], [fx, fy]], Math.max(.04, hair), Math.max(.022, hair * .8), col(C.leg, .9, -.35));
  }
  // The shell: a turban of whorls rising up and back from the opening.
  c.save(); c.rotate(pose.wobble);
  const whorls = [[-.04, -.24, .24], [-.24, -.33, .165], [-.37, -.39, .11], [-.46, -.43, .065]];
  for (const [i, [x, y, r]] of [...whorls.entries()].reverse()) {
    const g = c.createRadialGradient(x + r * .3, y - r * .45, r * .1, x, y, r * 1.05);
    g.addColorStop(0, col(C.lip, 1)); g.addColorStop(.55, col(C.shell, 1)); g.addColorStop(1, col(C.band, 1, -.2));
    c.fillStyle = g; oval(c, x, y, r * 1.05, r * .92, -.5);
    c.strokeStyle = col(C.band, .65); c.lineWidth = hair * 1.2;
    for (let k = 1; k <= 3; k++) { c.beginPath(); c.ellipse(x, y, r * (1.05 - k * .2), r * (.92 - k * .18), -.5, Math.PI * .9, Math.PI * 1.9); c.stroke(); }
    if (i === 0) { c.fillStyle = col(C.band, .5); for (let k = 0; k < 6; k++) oval(c, x - r * .55 + k * r * .2, y + r * .35 - k * r * .12, r * .06, r * .04, -.5); }
  }
  // The opening faces forward and down; the crab comes out of it.
  c.fillStyle = col(C.lip); oval(c, .15, -.15, .085, .1, .45);
  c.fillStyle = col(C.inside); oval(c, .16, -.145, .062, .075, .45);
  c.restore();
  if (out < .03) return;
  c.save(); c.translate(.16, -.15); c.scale(out, out); c.translate(-.16, .15);
  // Antennae and eyes on long yellow stalks.
  c.strokeStyle = col(C.leg, .9); c.lineWidth = Math.max(.008, hair * .8);
  for (const [a, len] of [[pose.whip, .55], [pose.whip - .25, .48]]) { c.beginPath(); c.moveTo(.26, -.24); c.quadraticCurveTo(.26 + Math.cos(a - .4) * len * .5, -.24 + Math.sin(a - .4) * len * .5, .26 + Math.cos(a) * len, -.24 + Math.sin(a) * len * .7); c.stroke(); }
  for (const dx of [0, .02]) {
    c.strokeStyle = col(C.eye, 1, dx ? -.2 : 0); c.lineWidth = Math.max(.024, hair); c.lineCap = "round";
    c.beginPath(); c.moveTo(.2 + dx, -.2); c.lineTo(.27 + dx, -.33); c.stroke();
    c.fillStyle = col("#0c0b0a"); dot(c, .275 + dx, -.345, .026);
    c.fillStyle = `rgba(255,255,255,${.7 * (1 - haze)})`; dot(c, .282 + dx, -.352, .008);
  }
  // Near legs, banded at the joints.
  for (const [i, [fx, fy]] of pose.near.entries()) {
    const [hx, hy] = HIPS[i], [kx, ky] = knee(hx, hy, fx, fy, .15, .17);
    limb(c, [[hx, hy], [kx, ky], [fx, fy]], Math.max(.05, hair * 1.2), Math.max(.026, hair * .9), col(C.leg));
    c.fillStyle = col(C.joint, .9); dot(c, kx, ky, .02);
    c.fillStyle = col("#f2e6d6", .8); dot(c, fx, fy - .01, .012);
  }
  // Two hairy claws held in front; one reaches down while it eats.
  for (const [dx, dy, reach] of [[.02, .02, 0], [0, 0, pose.work]]) {
    const bx = .22 + dx, by = -.16 + dy, tx = .33 + dx - reach * .02, ty = -.11 + dy + reach * .08;
    limb(c, [[bx, by], [tx, ty]], Math.max(.07, hair * 1.5), Math.max(.06, hair * 1.4), col(C.leg, 1, dx ? -.25 : 0));
    const g = c.createLinearGradient(0, ty - .05, 0, ty + .05);
    g.addColorStop(0, col(C.leg, 1, dx ? -.15 : .15)); g.addColorStop(1, col(C.leg, 1, dx ? -.35 : -.1));
    c.fillStyle = g; oval(c, tx + .06, ty + .015, .085, .05, .3);
    c.fillStyle = col("#f2e6d6", .95); oval(c, tx + .135, ty + .045, .026, .016, .3);
    c.fillStyle = col("#f2e6d6", .6); for (let k = 0; k < 4; k++) dot(c, tx + .01 + k * .025, ty - .02 + k * .006, .007);
  }
  c.restore();
}

// Hermit crabs wander the sand with their shells rocking, and pull back
// inside when a fish comes close or when they rest.
export class Hermit extends Crawler {
  constructor(spec, world, options) {
    super(spec, world, options);
    this.legs = new Gait([...RESTS.map((dx, i) => ({ dx, group: i })), ...RESTS.map((dx, i) => ({ dx: dx - .06, group: 1 - i, dz: .05 }))], { stride: .2, lift: .07, duration: .22 });
    this.out = this.state === "in" ? 0 : 1; this.whip = -.6; this.work = 0; this.shy = 0;
  }

  setActive(on, world, instant = false) {
    super.setActive(on, world, instant);
    if (instant) this.out = on ? 1 : 0;
  }

  startle(world) { this.shy = 3 + this.rand() * 3; this.goal = null; }

  step(dt, world) {
    const L = this.size(world);
    if (this.shy > 0) { this.shy -= dt; this.busy = true; this.vx = follow(this.vx, 0, 8, dt); } else this.busy = false;
    this.routine(dt, world);
    this.legs.update(dt, this.x, this.legScale(world), this.footing(world), this.vx);
    const inside = this.shy > 0 || this.state === "in";
    this.out = follow(this.out, inside ? 0 : 1, inside ? 9 : 2.5, dt);
    this.whip = follow(this.whip, -.55 + noise(this.seed, this.clock * .7) * .25 - clamp(this.vx * this.facing / L, -1, 1) * .25, 5, dt);
    this.work = this.eating > 0 ? .5 + Math.sin(this.clock * 8) * .5 : follow(this.work, 0, 4, dt);
  }

  draw(c, world) {
    const L = this.size(world), haze = this.z * .5;
    shadow(c, this.x - this.facing * L * .1, this.y + 1, L * .45, L * .1, .32 * (1 - haze));
    const lift = (1 - this.out) * -L * .02 + this.legs.airborne * L * .03;
    c.save(); c.translate(this.x, this.y - lift); c.scale(this.flipX * L, L);
    const feet = this.localFeet(L, lift);
    const wobble = Math.sin(this.clock * 7) * .04 * clamp(Math.abs(this.vx) / (L * .3), 0, 1);
    paintHermit(c, { near: feet.slice(0, 2), far: feet.slice(2), out: this.out, whip: this.whip, work: this.work, wobble }, haze, L);
    c.restore();
  }

  static portrait(c, spec, w, h) {
    const L = Math.min(w * .9 / 1.1, h * .9 / .7);
    c.save(); c.translate(w / 2 + L * .05, h * .88); c.scale(L, L);
    paintHermit(c, { near: RESTS.map(x => [x, 0]), far: RESTS.map(x => [x - .06, -.02]), out: 1, whip: -.55, work: 0, wobble: 0 }, 0, L);
    c.restore();
  }
}
