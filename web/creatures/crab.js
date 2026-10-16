import { curve, dot, limb, oval, shade, shadow, tone, wind } from "./paint.js";
import { Crawler, Gait, TAU, follow, knee, lerp, noise } from "./motion.js";

// Crabs walk sideways, so we see them from the front and a little from
// above. Shells are laid out in plan view in units of carapace width — u
// across the body, w from front (+) to back (−) — and then foreshortened.
// The arrow crab is the exception: its long rostrum only shows from the
// side, so it is drawn side-on and walks forward (see paintArrow).
const SQUASH = .45;

const LOOKS = {
  emerald: {
    plan: [[0, .4], [.12, .41], [.25, .38], [.37, .3], [.45, .16], [.48, 0], [.45, -.16], [.37, -.3], [.23, -.4], [0, -.43]],
    stand: .22, face: .1, hips: [[.42, .2], [.47, .04], [.45, -.12], [.39, -.27]], span: [.74, .84, .82, .7], upper: .3, lower: .36,
    claw: { hip: [.3, .36], palm: [.2, .5], size: .15, kind: "spoon" },
    colors: { shell: "#2f8a52", side: "#1f5f39", leg: "#3d8a57", claw: "#2f7f4c", tip: "#ece6d2", mark: "#5fb27c" },
  },
  porcelain: {
    plan: [[0, .42], [.15, .43], [.3, .38], [.42, .26], [.48, .08], [.47, -.1], [.41, -.26], [.28, -.38], [.12, -.43], [0, -.44]],
    stand: .17, face: .07, hips: [[.43, .12], [.46, -.06], [.41, -.22]], span: [.7, .76, .66], upper: .24, lower: .28,
    claw: { hip: [.36, .3], palm: [.44, .62], size: .2, kind: "flat" },
    colors: { shell: "#f3eee6", side: "#b9ad9e", leg: "#ece4d8", claw: "#efe8dd", tip: "#d9cbb9", mark: "#a5442f" },
  },
  swimmer: {
    plan: [[0, .3], [.1, .31], [.2, .28], [.32, .22], [.44, .13], [.62, .07], [.47, .02], [.38, -.1], [.26, -.22], [.12, -.28], [0, -.3]],
    stand: .2, face: .08, hips: [[.33, .16], [.36, .04], [.33, -.08], [.26, -.2]], span: [.62, .7, .68, .6], upper: .27, lower: .33,
    claw: { hip: [.26, .25], palm: [.5, .5], size: .17, kind: "long" },
    colors: { shell: "#5b5a49", side: "#3b3a2f", leg: "#6e6a62", claw: "#5e6688", tip: "#e9e3d6", mark: "#d9d6c8", paddle: "#7d7a6a" },
  },
};

// at maps a plan point to the screen: the front edge sits lowest.
const at = (look, u, w) => [u, -(look.stand + look.face) - (.42 - w) * SQUASH];

// paintCrab draws a crab facing us for a pose: feet in unit coordinates,
// the claws' work (0…1, alternating sides), raised claws when alarmed, and
// the paddles' stroke for a swimming crab.
function paintCrab(c, id, pose, haze, L) {
  const look = LOOKS[id], C = look.colors, hair = 1 / L, col = shade(haze);
  const outline = [...look.plan, ...look.plan.slice(1, -1).reverse().map(([u, w]) => [-u, w])];
  // Legs come out from under the shell's rim, back pairs first. Each has a
  // thick upper segment, a bend, and a pointed tip on the sand.
  const order = [...look.hips.keys()].reverse(), thick = Math.max(.055, hair * 1.4);
  for (const i of order) for (const side of [-1, 1]) {
    const [hu, hw] = look.hips[i], [hx, hy] = at(look, hu * side, hw), foot = pose.feet[i * 2 + (side > 0 ? 1 : 0)];
    const paddle = id === "swimmer" && i === look.hips.length - 1;
    const ankle = [foot[0] - side * .03, foot[1] - .07];
    const [kx, ky] = knee(hx, hy + look.face * .6, ankle[0], ankle[1], look.upper, look.lower - .06);
    const shade = (hw + .3) * .3 - .2;
    limb(c, [[hx, hy + look.face * .6], [kx, ky], ankle, paddle ? ankle : foot], thick, thick * .45, col(C.leg, 1, shade));
    c.fillStyle = col(C.leg, 1, shade - .15); dot(c, kx, ky, thick * .55);
    if (paddle) {
      c.save(); c.translate(ankle[0], ankle[1]); c.rotate(side * (.5 + Math.sin(pose.stroke) * .7));
      c.fillStyle = col(C.paddle, .95, .05); oval(c, side * .08, .01, .1, .045); c.restore();
    }
  }
  // Shell: its side shows as a darker band below the top.
  const rim = curve(new Path2D(), wind(outline.map(([u, w]) => at(look, u, w)).map(([x, y]) => [x, y + look.face])), true);
  c.fillStyle = col(C.side); c.fill(rim);
  const top = curve(new Path2D(), wind(outline.map(([u, w]) => at(look, u, w))), true);
  const [, y0] = at(look, 0, -.45), [, y1] = at(look, 0, .45);
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, col(C.shell, 1, .14)); g.addColorStop(1, col(C.shell, 1, -.1));
  c.fillStyle = g; c.fill(top);
  c.save(); c.clip(top);
  if (id === "emerald") { c.fillStyle = col(C.mark, .55); for (let i = 0; i < 26; i++) { const u = ((i * 47) % 89) / 89 - .5, w = ((i * 31) % 67) / 67 - .5; dot(c, ...at(look, u * .85, w * .8), .016); } }
  if (id === "porcelain") { c.fillStyle = col(C.mark, .9); for (let i = 0; i < 22; i++) { const u = ((i * 53) % 97) / 97 - .5, w = ((i * 29) % 61) / 61 - .5; oval(c, ...at(look, u * .85, w * .85), .03, .022); } }
  if (id === "swimmer") { c.fillStyle = col(C.mark, .55); for (let i = 0; i < 20; i++) { const u = ((i * 41) % 83) / 83 - .5, w = ((i * 23) % 59) / 59 - .5; oval(c, ...at(look, u, w * .7), .025, .015); } c.strokeStyle = col(C.side, .6); c.lineWidth = hair; c.beginPath(); curve(c, [at(look, -.25, .1), at(look, 0, -.05), at(look, .25, .1)]); c.stroke(); }
  const light = c.createRadialGradient(...at(look, -.1, -.1), .02, ...at(look, 0, 0), .5);
  light.addColorStop(0, `rgba(255,255,255,${.28 * (1 - haze)})`); light.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = light; c.fillRect(-.7, y0 - .1, 1.4, y1 - y0 + .2);
  c.restore();
  // Mouthparts; the porcelain crab sweeps the water with two feathery fans.
  const [, front] = at(look, 0, .42);
  c.fillStyle = col(C.side, 1, -.25); oval(c, 0, front + look.face * .55, .09, look.face * .35);
  if (id === "porcelain") for (const side of [-1, 1]) {
    const sweep = Math.max(0, Math.sin(pose.fan + (side > 0 ? Math.PI : 0)));
    c.save(); c.translate(side * .03, front + look.face * .4); c.rotate(side * (.3 + sweep * .9));
    c.strokeStyle = col("#efe6d8", .75); c.lineWidth = hair * .8;
    for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(side * .05 + k * .015, -.14 - sweep * .04 + Math.abs(k) * .01); c.stroke(); }
    c.restore();
  }
  // Eyes on short stalks at the front edge.
  for (const side of [-1, 1]) {
    const [ex, ey] = at(look, side * .1, .41), tilt = pose.look * .1 * side;
    c.strokeStyle = col(C.shell, 1, -.1); c.lineWidth = hair * 2.6; c.lineCap = "round";
    c.beginPath(); c.moveTo(ex, ey + .01); c.lineTo(ex + side * .025 + tilt, ey - .06); c.stroke();
    c.fillStyle = col("#0d0b0a"); dot(c, ex + side * .028 + tilt, ey - .07, .028);
    c.fillStyle = `rgba(255,255,255,${.7 * (1 - haze)})`; dot(c, ex + side * .028 + tilt + .008, ey - .078, .009);
  }
  // Claws in front: each in turn reaches down and brings food to the mouth;
  // alarmed, both rise.
  for (const side of [-1, 1]) {
    const cl = look.claw, [hx, hy] = at(look, cl.hip[0] * side, cl.hip[1]);
    const work = side < 0 ? Math.max(0, Math.sin(pose.work)) : Math.max(0, -Math.sin(pose.work));
    const raise = pose.alarm, arm = Math.max(.07, hair * 2);
    let px = cl.palm[0] * side, py = front + cl.palm[1] * .4;
    px = lerp(px, side * .06, work * .7); py = lerp(py, front + look.face * .5, work * .6) - work * .02;
    px += side * raise * .12; py -= raise * .3;
    const kx = lerp(hx, px, .5) + side * .1 * (1 - work), ky = lerp(hy, py, .5) + .05 - raise * .1;
    limb(c, [[hx, hy + look.face * .5], [kx, ky], [px, py]], arm, arm * .85, col(C.claw, 1, -.08));
    c.save(); c.translate(px, py); c.rotate(side * (cl.kind === "long" ? 1.1 : .5) - raise * side * .8); c.scale(-side, 1);
    // The claw points inward (+x here): a palm, then a fixed and a moving finger.
    const s = cl.size, long = cl.kind === "long", flat = cl.kind === "flat";
    const pl = s * (long ? 1.6 : flat ? 1 : .8), pw = s * (long ? .32 : flat ? .52 : .45);
    const gc = c.createLinearGradient(0, -pw, 0, pw);
    gc.addColorStop(0, col(C.claw, 1, .2)); gc.addColorStop(1, col(C.claw, 1, -.15));
    c.fillStyle = gc; oval(c, pl * .45, 0, pl * .55, pw);
    if (flat) { c.fillStyle = col(C.mark, .85); for (const [dx, dy] of [[.25, -.3], [.5, .2], [.7, -.15], [.4, .45]]) dot(c, pl * dx, pw * dy, s * .1); }
    if (long) { c.fillStyle = col(C.tip, .8); for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(pl * (.15 + k * .2), -pw * .9); c.lineTo(pl * (.2 + k * .2), -pw * 1.5); c.lineTo(pl * (.25 + k * .2), -pw * .9); c.fill(); } }
    const fx = pl * .95, gap = .25 + work * .2;
    c.fillStyle = col(C.claw, 1, -.18);
    c.beginPath(); c.moveTo(fx, -pw * .5); c.quadraticCurveTo(fx + s * .55, -pw * (.6 + gap), fx + s * .75, -pw * .05); c.quadraticCurveTo(fx + s * .4, -pw * .15, fx, pw * .05); c.fill();
    c.beginPath(); c.moveTo(fx, pw * .55); c.quadraticCurveTo(fx + s * .5, pw * (.6 + gap * .5), fx + s * .7, pw * .1); c.quadraticCurveTo(fx + s * .35, pw * .2, fx, pw * .1); c.fill();
    c.fillStyle = col(C.tip, .95);
    if (cl.kind === "spoon") { oval(c, fx + s * .7, -pw * .08, s * .13, s * .09); oval(c, fx + s * .65, pw * .14, s * .12, s * .08); }
    else { dot(c, fx + s * .72, -pw * .08, s * .05); dot(c, fx + s * .66, pw * .12, s * .045); }
    c.restore();
  }
}

// paintArrow draws the arrow crab side-on, facing right: a small striped
// triangle of a body slung between long, thin legs, a long pointed rostrum
// and slender claws with violet tips. Units are leg span.
function paintArrow(c, pose, haze, L) {
  const col = shade(haze), hair = 1 / L;
  const body = [[.12, -.42], [-.12, -.49], [-.17, -.42], [-.12, -.36], [.06, -.35]];
  const hips = [[.06, -.37], [.02, -.37], [-.03, -.38], [-.08, -.39]];
  const leg = (feet, color, width) => feet.forEach(([fx, fy], i) => {
    const [hx, hy] = hips[i], [kx, ky] = knee(hx, hy, fx, fy, .3, .36);
    limb(c, [[hx, hy], [kx, ky], [fx, fy]], width, width * .55, color);
    c.fillStyle = color; dot(c, kx, ky, width * .7);
  });
  leg(pose.far, col("#c9a46d", .75, -.35), Math.max(.012, hair * .9));
  c.fillStyle = col("#c39a5f"); c.fill(curve(new Path2D(), body, true));
  c.save(); c.clip(curve(new Path2D(), body, true));
  c.strokeStyle = col("#3c2a1b", .8); c.lineWidth = hair * 1.1;
  for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(.12, -.425 + k * .012); c.lineTo(-.18, -.5 + k * .03); c.stroke(); }
  c.strokeStyle = col("#f0d9a0", .7);
  for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(.12, -.418 + k * .012); c.lineTo(-.18, -.49 + k * .03); c.stroke(); }
  c.restore();
  // The rostrum points forward and a little up, like an arrow.
  c.fillStyle = col("#b98c52"); c.beginPath(); c.moveTo(.1, -.44); c.lineTo(.5, -.53); c.lineTo(.1, -.415); c.fill();
  c.strokeStyle = col("#3c2a1b", .6); c.lineWidth = hair * .8; c.beginPath(); c.moveTo(.12, -.43); c.lineTo(.48, -.525); c.stroke();
  c.fillStyle = col("#120e0b"); dot(c, .09, -.455, .016);
  // Slender claws reach forward and down; they pick at the bottom while eating.
  const reach = pose.work;
  for (const [dy, light] of [[0, -.3], [.01, 0]]) {
    const tip = [.36 - reach * .06 + pose.alarm * .05, -.18 + dy + reach * .14 - pose.alarm * .2];
    limb(c, [[.08, -.37 + dy], [.22, -.33 + dy], tip], Math.max(.018, hair), Math.max(.014, hair * .9), col("#c9a46d", 1, light));
    c.fillStyle = col("#7d5fb8", .95, light); oval(c, tip[0] + .03, tip[1] + .01, .035, .012, .5);
  }
  leg(pose.near, col("#d8b47c", .95), Math.max(.016, hair * 1.1));
}

// Crabs sidestep on alternating legs, pick at the bottom with their claws,
// raise them when a fish comes close, and (the swimming crab) paddle off
// the sand for a short swim or dig in to rest.
export class Crab extends Crawler {
  constructor(spec, world, options) {
    super(spec, world, options);
    this.arrow = spec.id === "arrow";
    if (this.arrow) {
      const rests = [.42, .22, -.08, -.32];
      this.legs = new Gait([...rests.map((dx, i) => ({ dx, group: i % 2 })), ...rests.map((dx, i) => ({ dx: dx + .05, group: 1 - i % 2, dz: .05 }))], { stride: .2, lift: .1, duration: .3 });
    } else {
      const look = LOOKS[spec.id], legs = [];
      look.hips.forEach(([, w], i) => { for (const side of [-1, 1]) legs.push({ dx: side * look.span[i], group: (i + (side > 0 ? 1 : 0)) % 2, dz: (.2 - w) * .08 }); });
      this.legs = new Gait(legs, { stride: .2, lift: .1, duration: .2 });
    }
    this.work = 0; this.alarm = 0; this.fan = 0; this.stroke = 0; this.swim = 0; this.rise = 0; this.buried = 0; this.look = 0;
  }

  get resting() { return this.state === "in" && !this.hides; }

  startle(world) { this.alarm = 1; this.goal = null; this.until = world.time + 3; }

  wander(world) {
    // Now and then the swimming crab paddles off instead of walking.
    if (this.spec.id === "swimmer" && this.rand() < .35) this.swim = 1.6 + this.rand();
    return super.wander(world);
  }

  step(dt, world) {
    const L = this.size(world);
    if (this.swim > 0) this.swim -= dt;
    const swimming = this.swim > 0 && this.state === "out";
    this.routine(dt * (swimming ? 2.2 : 1), world);
    this.rise = follow(this.rise, swimming ? L * .7 : 0, 3, dt);
    if (this.rise > L * .05) this.legs.place(this.x, this.legScale(world), (x, leg) => this.footing(world)(x, leg) - this.rise);
    else this.legs.update(dt, this.x, this.legScale(world), this.footing(world), this.vx);
    this.alarm = follow(this.alarm, 0, .7, dt);
    this.work = this.eating > 0 || (this.state === "out" && !this.goal && this.spec.id !== "porcelain") ? this.work + dt * (this.eating > 0 ? 7 : 2.5) : this.work;
    this.fan += dt * 6;
    this.stroke += dt * (swimming ? 14 : 0);
    this.look = noise(this.seed + 2, this.clock * .5);
    this.buried = follow(this.buried, this.resting && this.spec.id === "swimmer" ? 1 : 0, 1, dt);
  }

  draw(c, world) {
    if (this.hidden) return;
    const L = this.size(world), haze = this.z * .5;
    c.save(); c.globalAlpha = this.shown;
    shadow(c, this.x, this.y + 1, L * (this.arrow ? .35 : .55), L * .1, (this.arrow ? .2 : .32) * (1 - haze) / (1 + this.rise / L * 2));
    const lift = this.rise + this.legs.airborne * L * .02, sink = this.buried * L * .18;
    c.translate(this.x, this.y - lift + sink);
    if (sink > 0) { c.beginPath(); c.rect(-L * 2, -L * 2, L * 4, L * 2 - sink + 1); c.clip(); }
    if (this.arrow) {
      c.scale(this.flipX * L, L);
      const feet = this.localFeet(L, lift);
      paintArrow(c, { near: feet.slice(0, 4), far: feet.slice(4), work: this.eating > 0 ? .5 + Math.sin(this.clock * 8) * .5 : 0, alarm: this.alarm }, haze, L);
    } else {
      c.scale(L, L);
      const feet = this.localFeet(L, lift - sink);
      paintCrab(c, this.spec.id, { feet, work: this.work, alarm: this.alarm, fan: this.fan, stroke: this.stroke, look: this.look }, haze, L);
    }
    c.restore();
    if (this.buried > .01) { c.fillStyle = tone("#718371", haze, this.buried); c.beginPath(); c.ellipse(this.x, this.y + 1, L * .7, L * .1, 0, 0, TAU); c.fill(); }
  }

  static portrait(c, spec, w, h) {
    if (spec.id === "arrow") {
      const L = Math.min(w * .9 / 1.15, h * .9 / .6);
      c.save(); c.translate(w / 2 - L * .08, h * .92); c.scale(L, L);
      const near = [.42, .22, -.08, -.32].map(x => [x, 0]);
      paintArrow(c, { near, far: near.map(([x]) => [x + .05, -.02]), work: 0, alarm: 0 }, 0, L);
      c.restore(); return;
    }
    const look = LOOKS[spec.id], L = Math.min(w * .9 / 1.9, h * .88 / .85);
    c.save(); c.translate(w / 2, h * .88); c.scale(L, L);
    const feet = [];
    look.hips.forEach(([, wv], i) => { for (const side of [-1, 1]) feet.push([side * look.span[i], -(.2 - wv) * .08]); });
    paintCrab(c, spec.id, { feet, work: 0, alarm: 0, fan: 1, stroke: 0, look: 0 }, 0, L);
    c.restore();
  }
}
