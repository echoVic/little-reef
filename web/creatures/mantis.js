import { curve, dot, hole, limb, lip, oval, shade, shadow } from "./paint.js";
import { Crawler, Gait, clamp, follow, knee, noise } from "./motion.js";

// The peacock mantis shrimp is drawn facing right in units of body length,
// low on the ground at y = 0: a long flattened body, two big eyes on stalks
// that turn on their own, clubs folded under the head and a bright tail fan.
const C = { body: "#5d7f3e", dark: "#3a5226", head: "#8bab62", spot: "#33461f", leg: "#e8792f", club: "#e0602f", scale: "#e46a35", edge: "#b0302a", tail: "#4565c8", rim: "#d24a32", eye: "#43b4a4" };
const HIPS = [[.14, -.05], [.1, -.05], [.06, -.05]];
const RESTS = [.2, .12, .04];

// paintMantis draws the mantis shrimp for a pose: feet in unit coordinates,
// the eyes' angles, and strike (0…1) when its club snaps out for food.
function paintMantis(c, pose, haze, L) {
  const col = shade(haze), hair = 1 / L, thin = Math.max(.014, hair * .9);
  for (const [fx, fy] of pose.far) limb(c, [[.1, -.05], knee(.1, -.05, fx, fy, .045, .05), [fx, fy]], thin, thin * .7, col(C.leg, .7, -.35));
  // Tail fan: blue blades edged in red.
  for (const [a, len] of [[-.45, .12], [.45, .12], [-.2, .13], [.2, .13]]) {
    c.save(); c.translate(-.4, -.07); c.rotate(Math.PI + a * .6);
    c.fillStyle = col(C.rim); oval(c, len * .5, 0, len * .55, .032);
    c.fillStyle = col(C.tail); oval(c, len * .48, 0, len * .46, .022);
    c.restore();
  }
  c.fillStyle = col(C.body, 1, .1); oval(c, -.43, -.07, .05, .035);
  // Body: one long, flattened body crossed by segment lines, red spots along
  // its sides, then the spotted head shield.
  const body = curve(new Path2D(), [[.22, -.125], [.05, -.13], [-.15, -.14], [-.33, -.13], [-.42, -.105], [-.44, -.06], [-.36, -.03], [-.15, -.02], [.05, -.022], [.22, -.03]], true);
  const g = c.createLinearGradient(0, -.14, 0, -.02);
  g.addColorStop(0, col(C.body, 1, .15)); g.addColorStop(.6, col(C.body)); g.addColorStop(1, col(C.dark));
  c.fillStyle = g; c.fill(body);
  c.save(); c.clip(body);
  c.strokeStyle = col(C.dark, .85); c.lineWidth = Math.max(.008, hair);
  for (let i = 0; i < 8; i++) { const x = -.36 + i * .075; c.beginPath(); c.moveTo(x + .012, -.15); c.quadraticCurveTo(x - .012, -.08, x + .01, -.01); c.stroke(); }
  c.fillStyle = col(C.edge, .75); for (let i = 0; i < 7; i++) dot(c, -.33 + i * .075, -.035, .009);
  c.fillStyle = `rgba(255,255,255,${.18 * (1 - haze)})`; c.fillRect(-.45, -.15, .7, .03);
  c.restore();
  const head = [[.47, -.1], [.42, -.15], [.3, -.16], [.2, -.14], [.18, -.06], [.3, -.04], [.42, -.05]];
  const hp = curve(new Path2D(), head, true);
  c.fillStyle = col(C.head); c.fill(hp);
  c.save(); c.clip(hp); c.fillStyle = col(C.spot, .8);
  for (const [x, y, r] of [[.24, -.12, .012], [.29, -.09, .01], [.34, -.13, .011], [.38, -.08, .009], [.27, -.06, .008], [.41, -.12, .008], [.21, -.09, .009]]) dot(c, x, y, r);
  c.restore();
  // Antennal scales flare at the sides of the head.
  for (const tilt of [-.5, -.2]) { c.save(); c.translate(.42, -.09); c.rotate(tilt); c.fillStyle = col(C.edge); oval(c, .05, 0, .055, .022); c.fillStyle = col(C.scale); oval(c, .048, -.002, .045, .015); c.restore(); }
  // The club folds under the head; it snaps forward to strike.
  const strike = pose.strike, reach = .06 + strike * .14;
  limb(c, [[.36, -.06], [.42 + strike * .05, -.02], [.36 + reach, -.035 + strike * .02]], Math.max(.03, hair * 1.2), Math.max(.026, hair), col(C.club, 1, -.1));
  c.fillStyle = col(C.club, 1, .08); oval(c, .37 + reach, -.035 + strike * .02, .03, .022, -.3 + strike);
  c.fillStyle = col("#f1d9cf", .8); dot(c, .38 + reach, -.04 + strike * .02, .007);
  for (const [fx, fy] of pose.near) limb(c, [[.12, -.045], knee(.12, -.045, fx, fy, .045, .05), [fx, fy]], thin * 1.2, thin * .8, col(C.leg));
  // Antennules: three thin whips.
  c.strokeStyle = col(C.leg, .8); c.lineWidth = thin * .7;
  for (const a of [-.55, -.35, -.15]) { c.beginPath(); c.moveTo(.46, -.13); c.quadraticCurveTo(.56, -.18 + a * .1, .7 + a * .1, -.24 + a * .25 + pose.sway * .02); c.stroke(); }
  // Eyes on stalks, each turning on its own; a band divides every eye.
  pose.eyes.forEach((turn, i) => {
    const bx = .44 - i * .03, by = -.15;
    c.strokeStyle = col(C.head, 1, -.1); c.lineWidth = Math.max(.018, hair); c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + .02, by - .05); c.stroke();
    c.save(); c.translate(bx + .022, by - .07); c.rotate(turn);
    c.fillStyle = col(C.eye, 1, i ? -.25 : 0); oval(c, 0, 0, .03, .045);
    c.fillStyle = col("#1e3b3a", .85); c.fillRect(-.03, -.006, .06, .012);
    c.fillStyle = `rgba(255,255,255,${.6 * (1 - haze)})`; dot(c, -.006, -.018, .006);
    c.restore();
  });
}

// The mantis shrimp lives in a burrow: resting, it watches from the opening
// with only its eyes showing; out, it patrols nearby and strikes at food.
export class Mantis extends Crawler {
  constructor(spec, world, options) {
    super(spec, world, options);
    this.legs = new Gait([...RESTS.map((dx, i) => ({ dx, group: i % 2 })), ...RESTS.map((dx, i) => ({ dx: dx - .03, group: 1 - i % 2, dz: .04 }))], { stride: .12, lift: .03, duration: .16 });
    this.eyes = [0, 0]; this.strike = 0; this.peek = 1; this.sway = 0;
    this.rise = this.state === "in" ? 0 : 1;
  }

  settle(world) {
    const b = world.burrows.mantis;
    this.burrow = b; this.home = this.den = { x: b.x, z: b.z }; this.depths = [Math.max(0, b.z - .08), b.z + .08]; this.hides = true;
  }

  startle() { this.hideAway(10 + this.rand() * 10); }

  setActive(on, world, instant = false) {
    super.setActive(on, world, instant);
    if (instant) { this.rise = on ? 1 : 0; this.peek = on ? 0 : 1; }
  }

  step(dt, world) {
    this.busy = this.state === "out" && this.rise < .8;
    if (this.busy) this.vx = 0;
    this.routine(dt, world);
    const near = 1 - clamp(Math.abs(this.x - this.burrow.x) / (this.size(world) * .5), 0, 1);
    this.rise = follow(this.rise, this.state === "in" || this.peek >= .05 ? 0 : this.state === "leaving" ? 1 - near : 1, 4, dt);
    this.legs.update(dt, this.x, this.legScale(world), this.footing(world), this.vx);
    const t = this.clock;
    this.eyes = [noise(this.seed, t * .7) * 1.2, noise(this.seed + 1, t * .6 + 3) * 1.2];
    this.strike = this.eating > 0 ? Math.max(0, Math.sin(t * 5)) ** 6 : follow(this.strike, 0, 10, dt);
    this.peek = this.state === "in" && this.rise <= .02 ? follow(this.peek, noise(this.seed + 5, t * .08) > -.35 ? 1 : 0, 1.5, dt) : follow(this.peek, 0, 6, dt);
    this.sway = Math.sin(t * 2);
  }

  under(c, world) { const b = this.burrow; hole(c, b.x, world.ground(b.x, b.z), this.spec.length * world.px * .2); }

  draw(c, world) {
    const L = this.size(world), haze = this.z * .5, b = this.burrow, by = world.ground(b.x, b.z), r = this.spec.length * world.px * .2;
    const pose = { near: [], far: [], eyes: this.eyes, strike: this.strike, sway: this.sway };
    if (this.rise > .02) {
      const sink = 1 - this.rise;
      shadow(c, this.x, this.y + 1, L * .5, L * .07, .3 * (1 - haze) * (1 - sink));
      c.save();
      if (sink > 0) { c.beginPath(); c.rect(this.x - L, this.y - L, L * 2, L + 1); c.clip(); }
      c.translate(this.x, this.y + sink * L * .5); c.scale(this.flipX * L, L);
      const feet = this.localFeet(L);
      pose.near = feet.slice(0, 3); pose.far = feet.slice(3);
      paintMantis(c, pose, haze, L);
      c.restore();
    } else {
      // Watching from the burrow: head up, the rest hidden below the rim.
      if (this.peek < .05) { lip(c, b.x, by, r); return; }
      c.save(); c.beginPath(); c.rect(b.x - L, by - L, L * 2, L - r * .15); c.clip();
      c.translate(b.x - this.facing * L * .1, by + L * (.62 - this.peek * .28)); c.scale(this.facing * L, L); c.rotate(-1.3);
      paintMantis(c, pose, haze, L);
      c.restore();
    }
    lip(c, b.x, by, r);
  }

  static portrait(c, spec, w, h) {
    const L = Math.min(w * .9 / 1.15, h * .85 / .38);
    c.save(); c.translate(w / 2 - L * .1, h * .75); c.scale(L, L);
    paintMantis(c, { near: RESTS.map(x => [x, 0]), far: RESTS.map(x => [x - .03, -.01]), eyes: [.3, -.4], strike: 0, sway: 0 }, 0, L);
    c.restore();
  }
}
