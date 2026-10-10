const palettes = {
  resident: ["#e8bd91", "#db976e", "#fae5c3"],
  clown: ["#efad70", "#d77a51", "#fff0cf"],
  tang: ["#75a7d8", "#446b9b", "#f4d383"],
  angel: ["#c1b0dc", "#8a78b0", "#e7d7ee"],
  puffer: ["#bacb95", "#839c6e", "#e7e9c4"],
};

export class Reef {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = null;
    this.time = 0;
    this.last = 0;
    this.frame = null;
    this.foodUntil = 0;
    this.fish = Array.from({ length: 5 }, (_, i) => ({ x: .15 + i * .16, y: .25 + (i % 3) * .14, speed: .016 + i * .002, dir: i % 2 ? -1 : 1, phase: i * 2.1 }));
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", () => this.schedule());
    this.motion.addEventListener("change", () => this.schedule());
    this.resize();
    this.schedule();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const scale = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.ceil(this.width * scale);
    this.canvas.height = Math.ceil(this.height * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.draw();
  }

  update(state) {
    const oldFed = this.state?.fedSession;
    this.state = state;
    if (oldFed !== undefined && state.fedSession !== oldFed && state.fedSession) this.foodUntil = this.time + 5;
    this.draw();
  }

  schedule() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    if (document.hidden || this.motion.matches) { this.draw(); return; }
    this.last = 0;
    const animate = (now) => {
      this.frame = requestAnimationFrame(animate);
      if (this.last && now - this.last < 1000 / 24) return;
      const delta = this.last ? Math.min((now - this.last) / 1000, .15) : 0;
      this.last = now;
      this.time += delta;
      for (const f of this.fish) {
        f.x += delta * f.speed * f.dir;
        if (f.x > .88) f.dir = -1;
        if (f.x < .12) f.dir = 1;
      }
      this.draw();
    };
    this.frame = requestAnimationFrame(animate);
  }

  plant(x, height, seed, coral = false) {
    const c = this.ctx, h = this.height;
    const sway = Math.sin(this.time * .5 + seed) * 5;
    c.save(); c.translate(x, h - 25);
    c.lineCap = "round";
    if (coral) {
      c.strokeStyle = "#bd918c"; c.lineWidth = 4;
      for (let i = 0; i < 5; i++) {
        const side = i % 2 ? 1 : -1, y = -height * (.3 + i * .14);
        c.beginPath(); c.moveTo(0, 2); c.quadraticCurveTo(sway / 3, -height / 2, sway, -height); c.stroke();
        c.beginPath(); c.moveTo(sway * .3, y + 12); c.quadraticCurveTo(side * 15, y, side * 18, y - 18); c.stroke();
      }
    } else {
      c.strokeStyle = seed % 2 ? "#529a86" : "#70af91"; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-8, -height / 3, 10 + sway, -height * .7, sway, -height); c.stroke();
      for (let i = 0; i < 4; i++) {
        const y = -height * (.2 + i * .19), side = i % 2 ? 1 : -1;
        c.fillStyle = i % 2 ? "#79b89b" : "#568d7c";
        c.beginPath(); c.moveTo(sway * .2, y); c.quadraticCurveTo(side * 25, y - 3, side * 16 + sway, y - 22); c.quadraticCurveTo(side * 2, y - 17, sway * .2, y); c.fill();
      }
    }
    c.restore();
  }

  drawFish(f, index, kind, scale = 1) {
    const c = this.ctx;
    const colors = palettes[kind] || palettes.resident;
    const food = this.foodUntil > this.time;
    const y = food ? this.height * .23 : this.height * f.y + Math.sin(this.time * .7 + f.phase) * 8;
    const x = food ? this.width * (.35 + index * .09) : this.width * f.x;
    c.save(); c.translate(x, y); c.scale(f.dir * scale, scale);
    const tail = Math.sin(this.time * 3 + f.phase) * 3;
    c.fillStyle = colors[1];
    c.beginPath(); c.moveTo(-19, 0); c.lineTo(-36, -13 + tail); c.quadraticCurveTo(-30, 0, -36, 13 + tail); c.closePath(); c.fill();
    c.fillStyle = colors[0];
    c.beginPath(); c.ellipse(0, 0, 25, kind === "puffer" ? 18 : 14, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = colors[2];
    c.beginPath(); c.ellipse(4, 6, 16, 6, 0, 0, Math.PI * 2); c.fill();
    if (kind === "clown") {
      c.strokeStyle = "#fff0cf"; c.lineWidth = 5;
      for (const at of [-9, 9]) { c.beginPath(); c.moveTo(at, -11); c.quadraticCurveTo(at - 3, 0, at, 11); c.stroke(); }
    }
    c.fillStyle = colors[1]; c.globalAlpha = .7;
    c.beginPath(); c.moveTo(-2, -12); c.lineTo(-12, -21); c.lineTo(10, -11); c.fill();
    c.beginPath(); c.moveTo(-1, 2); c.quadraticCurveTo(-3 + tail, 16, -11, 9); c.fill();
    c.globalAlpha = 1; c.fillStyle = "#243940";
    c.beginPath(); c.arc(15, -3, 2.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#fff3db"; c.beginPath(); c.arc(15.7, -3.7, .8, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  draw() {
    if (!this.ctx) return;
    const c = this.ctx, w = this.width, h = this.height, t = this.time;
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#b4cfb114";
    for (let i = 0; i < 18; i++) {
      const y = h - ((t * (7 + i % 3) + i * 27) % (h + 30));
      const x = (i * 43 + 21) % w + Math.sin(t * .2 + i) * 8;
      c.beginPath(); c.arc(x, y, 1 + i % 2, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = "#53675a"; c.beginPath(); c.moveTo(0, h);
    c.lineTo(0, h - 28); c.bezierCurveTo(w * .25, h - 53, w * .7, h - 7, w, h - 34); c.lineTo(w, h); c.fill();
    c.fillStyle = "#718371"; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h - 17); c.bezierCurveTo(w * .4, h - 43, w * .62, h - 17, w, h - 25); c.lineTo(w, h); c.fill();
    for (let i = 0; i < 25; i++) { c.fillStyle = i % 2 ? "#899781" : "#566c5e"; c.beginPath(); c.ellipse((i * 71 + 14) % w, h - 8 - i % 19, 1.5, 1, 0, 0, Math.PI * 2); c.fill(); }
    // Decorative rocks exist from day one; plants and coral grow with rounds.
    c.fillStyle = "#6d8179"; c.beginPath(); c.ellipse(w * .81, h - 25, 28, 14, -.15, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#82948a"; c.beginPath(); c.ellipse(w * .85, h - 20, 17, 10, .2, 0, Math.PI * 2); c.fill();
    const growth = this.state?.completed || 0;
    if (growth > 0) {
      const plants = Math.min(8, 1 + Math.floor((growth - 1) / 3));
      for (let i = 0; i < plants; i++) {
        const progress = Math.min(3, Math.max(1, growth - i * 3));
        this.plant(w * (.09 + ((i * .137) % .71)), 28 + progress * 18, i, i > 0 && i % 3 === 0);
      }
      // Mature reefs keep changing their bed color and gentle lighting.
      if (growth >= 24) { c.fillStyle = "#a8deba08"; c.fillRect(0, 0, w, h); }
    }
    const known = this.state?.visitors || [];
    this.drawFish(this.fish[0], 0, "resident", 1);
    known.forEach((visitor, i) => this.drawFish(this.fish[i + 1], i + 1, visitor.species, .68 + i * .06));
    if (this.foodUntil > t) {
      c.fillStyle = "#e2c294";
      for (let i = 0; i < 10; i++) { c.beginPath(); c.arc(w * (.32 + i * .027), h * .05 + (5 - (this.foodUntil - t)) * 9 + i % 3 * 4, 1.5, 0, Math.PI * 2); c.fill(); }
    }
  }
}
