// Motion shared by the creature models: seeded randomness, smooth noise,
// limbs, legs that keep their feet planted, and the crawlers' daily routine.
export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);

// hash turns a species id into a stable seed, so placement survives redraws.
export function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}

// random returns a seeded generator of numbers in [0, 1).
export function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lattice(seed, i) {
  let h = Math.imul(seed ^ Math.imul(i, 374761393), 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 2147483648 - 1;
}

// noise is smooth value noise in −1…1 along t, different for every seed.
export function noise(seed, t) {
  const i = Math.floor(t);
  return lerp(lattice(seed, i), lattice(seed, i + 1), smooth(t - i));
}

// follow eases a value toward its target; rate is how quickly, per second.
export function follow(value, target, rate, dt) {
  return target + (value - target) * Math.exp(-rate * dt);
}

// knee finds the joint of a two-segment limb from a hip to a foot, on the
// upper side of the line between them (or the lower side when up is false).
export function knee(hx, hy, fx, fy, upper, lower, up = true) {
  const dx = fx - hx, dy = fy - hy;
  const d = clamp(Math.hypot(dx, dy), 1e-6, upper + lower - 1e-6);
  const a = (upper * upper - lower * lower + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const ux = dx / d, uy = dy / d, px = hx + ux * a, py = hy + uy * a;
  const side = (ux > 0) === up ? -1 : 1;
  return [px - uy * h * side, py + ux * h * side];
}

// Gait keeps each foot planted until the body has moved past it, then
// swings it ahead. Legs belong to two groups that never swing at the same
// time, so the walk alternates the way a real one does. Rest offsets are in
// body lengths; sx scales them to pixels and mirrors them with the facing.
export class Gait {
  constructor(legs, { stride = .3, lift = .08, duration = .2 } = {}) {
    this.legs = legs.map(leg => ({ group: 0, ...leg, x: 0, y: 0, fromX: 0, fromY: 0, toX: 0, t: 1 }));
    this.stride = stride; this.lift = lift; this.duration = duration;
    this.placed = false;
  }

  // place puts every foot straight under its rest position.
  place(x, sx, ground) {
    for (const leg of this.legs) { leg.x = leg.toX = x + leg.dx * sx; leg.y = ground(leg.x, leg); leg.t = 1; }
    this.placed = true;
  }

  // update swings stepping feet and starts new steps; vx is the body's speed.
  update(dt, x, sx, ground, vx) {
    if (!this.placed) { this.place(x, sx, ground); return; }
    const L = Math.abs(sx), stride = this.stride * L, walking = Math.abs(vx) > stride * .25;
    for (const leg of this.legs) {
      if (leg.t < 1) {
        leg.t = Math.min(1, leg.t + dt / this.duration);
        const e = smooth(leg.t);
        leg.x = lerp(leg.fromX, leg.toX, e);
        leg.y = lerp(leg.fromY, ground(leg.x, leg), e) - Math.sin(Math.PI * leg.t) * this.lift * L;
      } else leg.y = ground(leg.x, leg);
    }
    for (const leg of this.legs) {
      if (leg.t < 1) continue;
      const rest = x + leg.dx * sx;
      if (Math.abs(leg.x - rest) < stride * (walking ? .5 : .15)) continue;
      if (this.legs.some(o => o.t < 1 && o.group !== leg.group)) continue;
      leg.fromX = leg.x; leg.fromY = leg.y;
      leg.toX = rest + (walking ? Math.sign(vx) * stride * .45 : 0);
      leg.t = 0;
    }
  }

  // airborne tells how much of the body's weight is off the ground (0…1).
  get airborne() {
    let up = 0;
    for (const leg of this.legs) if (leg.t < 1) up += Math.sin(Math.PI * leg.t);
    return up / this.legs.length;
  }
}

// Crawler is the routine shared by shrimp and crabs. While out it wanders
// near home, picks up food that reached the sand and flinches when a fish
// comes close; sent in, it walks to its den and rests or hides there.
// Models add the body, legs and drawing.
export class Crawler {
  constructor(spec, world, { enter = false } = {}) {
    this.spec = spec;
    this.seed = hash(spec.id);
    this.rand = random(this.seed ^ 0x51ed27);
    this.crawler = true;
    this.active = false;
    this.state = "in";
    this.settle(world);
    this.x = this.den.x; this.z = this.den.z;
    this.facing = this.rand() < .5 ? -1 : 1;
    this.vx = 0; this.goal = null; this.until = 0;
    this.meal = null; this.eating = 0; this.calm = 0;
    this.turn = 0; this.shown = 0; this.clock = this.rand() * 100; this.retreat = 0;
    if (enter) {
      this.state = "out"; this.active = true; this.shown = 1;
      this.x = this.rand() < .5 ? -world.width * .04 : world.width * 1.04;
      this.z = this.home.z; this.goal = { x: this.home.x, z: this.home.z };
    }
    this.y = world.surface(this.x, this.z);
  }

  // size is the body length in pixels at the current depth.
  size(world) { return this.spec.length * world.px * (1 - .3 * this.z); }

  // settle chooses home (where it spends its time out) and den (where it
  // rests). Rock dwellers live on a rock and hide behind it; others use a
  // patch of sand. Models with burrows override this.
  settle(world) {
    const W = world.width, s = this.spec;
    if (s.rock) {
      const rocks = world.rocks, r = rocks[[0, 2, 1, 3][this.seed % 4] % rocks.length];
      const x = r.x + (this.rand() - .5) * r.rx * .8;
      this.home = { x, z: r.z };
      this.den = { x: r.x + (this.rand() - .5) * r.rx * .4, z: Math.min(1, r.z + .22) };
      this.depths = [Math.max(0, r.z - .12), r.z + .04];
      this.hides = true;
    } else {
      const x = W * (.12 + (this.seed % 1000) / 1000 * .76);
      const [z0, z1] = s.depths || [.15, .7];
      this.home = { x, z: lerp(z0, z1, this.rand()) };
      this.den = this.home;
      this.depths = [z0, z1];
      this.hides = false;
    }
  }

  // hidden reports whether nothing of it shows right now.
  get hidden() { return this.shown < .02; }

  setActive(on, world, instant = false) {
    const was = this.state;
    this.active = on;
    this.drop();
    if (on) {
      if (instant) { this.x = this.home.x; this.z = this.home.z; this.goal = null; this.until = world.time + this.rand() * 4; this.shown = 1; }
      else { if (was === "in") { this.x = this.den.x; this.z = this.den.z; } this.goal = { x: this.home.x, z: this.home.z }; }
      this.state = "out";
    } else if (instant) {
      this.state = "in"; this.x = this.den.x; this.z = this.den.z; this.goal = null; this.vx = 0;
      this.shown = this.hides ? 0 : 1;
    } else {
      this.state = "leaving"; this.goal = { x: this.den.x, z: this.den.z };
    }
    this.y = world.surface(this.x, this.z);
  }

  resize(sx, sy, world) {
    this.settle(world);
    this.x *= sx; this.goal = null;
    if (this.state !== "out") { this.state = this.active ? "out" : "in"; this.x = this.active ? this.home.x : this.den.x; this.z = this.active ? this.home.z : this.den.z; }
    this.y = world.surface(this.x, this.z);
    this.legs?.place(this.x, this.legScale(world), this.footing(world));
  }

  // flipX is the horizontal scale for drawing: the facing, squashed while it turns around.
  get flipX() { return this.turn ? this.facing * Math.max(.2, Math.abs(Math.cos(Math.PI * this.turn))) : this.facing; }

  // localFeet maps the feet into body units for drawing, with the body raised by lift pixels.
  localFeet(L, lift = 0) {
    const sx = this.spec.sideways ? L : this.flipX * L;
    return this.legs.legs.map(leg => [(leg.x - this.x) / sx, (leg.y - this.y + lift) / L]);
  }

  // legScale mirrors leg offsets with the facing; front-on crabs don't.
  legScale(world) { return this.size(world) * (this.spec.sideways ? 1 : this.facing); }

  // footing is the ground the legs stand on: the body's own surface, with
  // feet on the far side a little higher, as they would look from above.
  footing(world) { const L = this.size(world); return (x, leg) => world.surface(x, this.z) - (leg.dz || 0) * L * 1.5; }

  // wander picks the next spot to walk to while out.
  wander(world) {
    const r = world.width * (this.spec.range || .2);
    return { x: clamp(this.home.x + (this.rand() * 2 - 1) * r, world.width * .04, world.width * .96), z: lerp(this.depths[0], this.depths[1], this.rand()) };
  }

  // routine moves the body; models call it from step before animating.
  routine(dt, world) {
    const t = world.time, L = this.size(world);
    this.clock += dt;
    // After a scare it stays home a while, then comes back out.
    if (this.retreat > 0 && (this.retreat -= dt) <= 0 && this.active && this.state === "in") { this.state = "out"; this.goal = { x: this.home.x, z: this.home.z }; }
    if (this.eating > 0) {
      this.eating -= dt; this.vx = follow(this.vx, 0, 8, dt);
      if (this.eating <= 0 && this.meal) { world.eat(this.meal); this.meal = null; }
    } else if (this.state !== "in" && !this.busy) {
      if (this.state === "out") {
        const food = this.forage(world);
        if (food) this.goal = { x: food.x - this.reach(L) * (Math.sign(food.x - this.x) || this.facing), z: food.z, food };
        else if (!this.goal && t > this.until) this.goal = this.wander(world);
        if (t > this.calm) this.watch(world, L);
      }
      if (this.goal) {
        const dx = this.goal.x - this.x, dz = this.goal.z - this.z;
        const speed = this.spec.speed * L * (this.state === "leaving" ? 1.2 : 1);
        this.vx = follow(this.vx, clamp(dx * 3, -speed, speed), 4, dt);
        this.z = clamp(this.z + clamp(dz * 1.5, -.2, .2) * dt, 0, 1);
        if (Math.abs(dx) < L * .1 && Math.abs(dz) < .03) {
          if (this.goal.food && !this.goal.food.eaten) { this.meal = this.goal.food; this.eating = 1.8; }
          this.goal = null;
          if (this.state === "leaving") this.state = "in";
          else this.until = t + (2 + this.rand() * 6) * (this.spec.idle || 1);
        }
      } else this.vx = follow(this.vx, 0, 6, dt);
    } else if (!this.busy) this.vx = follow(this.vx, 0, 6, dt);
    this.x += this.vx * dt;
    if (!this.spec.sideways && !this.turn && Math.abs(this.vx) > L * .08 && Math.sign(this.vx) !== this.facing) this.turn = 1e-3;
    if (this.turn) { this.turn += dt / .35; if (this.turn >= .5) this.facing = Math.sign(this.vx) || this.facing; if (this.turn >= 1) this.turn = 0; }
    this.shown = follow(this.shown, this.state === "in" && this.hides ? 0 : 1, 3, dt);
    this.y = world.surface(this.x, this.z);
  }

  // forage finds food lying on the sand within reach of home.
  forage(world) {
    if (this.goal?.food && !this.goal.food.eaten) return this.goal.food;
    let best = null, bd = world.width * (this.spec.range || .2) * 1.5;
    for (const p of world.pellets) {
      if (!p.landed || p.eaten || p.claimed) continue;
      const d = Math.abs(p.x - this.x);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) best.claimed = true;
    return best;
  }

  // reach is how far from the body's center food is picked up.
  reach(L) { return this.spec.sideways ? 0 : L * .4; }

  // watch flinches when a fish swims within a body length.
  watch(world, L) {
    for (const f of world.fish) {
      if (Math.abs(f.z - this.z) > .3) continue;
      if (Math.hypot(f.x - this.x, f.y - this.y) < L + f.size(world) * .4) { this.calm = world.time + 8; this.startle(world, f); return; }
    }
  }

  // startle is the model's flinch; by default it freezes for a moment.
  startle(world) { this.goal = null; this.until = world.time + 2.5; }

  // hideAway runs home to the den for a while, still counted as out.
  hideAway(seconds) { this.drop(); this.retreat = seconds; this.state = "leaving"; this.goal = { x: this.den.x, z: this.den.z }; }

  // drop gives up the pellet it was walking to, so another can have it.
  drop() { if (this.goal?.food) this.goal.food.claimed = false; }

}
