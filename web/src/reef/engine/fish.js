import { curve, dot, oval, shade } from "./paint.js";
import { TAU, clamp, follow, hash, lerp, noise, random } from "./motion.js";

// Looks are drawn facing right in units of body length: the snout is at
// x = .5 and the base of the tail at x = −.5, and y grows downward. Body
// stations are [x, top, bottom]. A fin lists its outer edge from front to
// back; its base runs along the body under the first and last points. The
// tail fin, pectoral and pelvic fins are drawn from their own base point.
const LOOKS = {
  // Lyretail anthias (sea goldfish), female: the resident.
  resident: {
    body: [[.5, .005, .01], [.45, -.07, .06], [.36, -.14, .12], [.2, -.18, .155], [0, -.18, .155], [-.2, -.145, .125], [-.36, -.095, .08], [-.5, -.065, .055]],
    eye: [.35, -.035, .062], mouth: [.5, .006], gill: .21,
    dorsal: { edge: [[.25, -.16], [.21, -.25], [.14, -.27], [.06, -.265], [-.02, -.26], [-.1, -.255], [-.19, -.26], [-.28, -.25], [-.35, -.2], [-.41, -.1]] },
    anal: { edge: [[-.07, .14], [-.12, .23], [-.2, .29], [-.28, .25], [-.35, .16], [-.4, .085]] },
    caudal: { edge: [[0, -.065], [-.1, -.15], [-.26, -.25], [-.52, -.37], [-.33, -.17], [-.24, -.03], [-.24, .03], [-.33, .17], [-.52, .37], [-.26, .25], [-.1, .15], [0, .065]] },
    pectoral: { at: [.2, .045], edge: [[0, -.025], [-.08, -.05], [-.17, -.035], [-.2, .005], [-.15, .04], [-.07, .045], [0, .025]], angle: .25 },
    pelvic: { at: [.15, .14], edge: [[0, -.01], [-.05, .08], [-.17, .17], [-.1, .06], [-.03, .01]] },
    pattern(c, col) {
      // A violet line runs from under the eye down to the pectoral fin.
      c.strokeStyle = col("#a98ad8", .9); c.lineWidth = .028; c.lineCap = "round";
      c.beginPath(); c.moveTo(.33, .03); c.quadraticCurveTo(.26, .06, .18, .085); c.stroke();
    },
  },
  // Ocellaris clownfish.
  clown: {
    body: [[.5, .015, .025], [.47, -.07, .09], [.38, -.19, .18], [.22, -.255, .225], [0, -.26, .23], [-.2, -.2, .18], [-.36, -.13, .115], [-.5, -.1, .085]],
    eye: [.345, -.05, .062], mouth: [.5, .02], gill: .27,
    dorsal: { edge: [[.23, -.24], [.19, -.31], [.13, -.335], [.07, -.34], [.02, -.325], [-.03, -.29], [-.07, -.35], [-.15, -.39], [-.24, -.37], [-.31, -.3], [-.36, -.16]], line: "#1d1512" },
    anal: { edge: [[-.1, .21], [-.14, .3], [-.21, .34], [-.29, .3], [-.35, .2], [-.37, .11]], line: "#1d1512" },
    caudal: { edge: [[0, -.09], [-.08, -.19], [-.19, -.24], [-.29, -.19], [-.33, -.08], [-.34, 0], [-.33, .08], [-.29, .19], [-.19, .24], [-.08, .19], [0, .09]], line: "#1d1512" },
    pectoral: { at: [.18, .05], edge: [[0, -.025], [-.07, -.055], [-.15, -.045], [-.19, 0], [-.16, .045], [-.08, .055], [0, .025]], angle: .2 },
    pelvic: { at: [.13, .2], edge: [[0, -.01], [-.05, .06], [-.12, .11], [-.09, .05], [-.03, 0]], line: "#1d1512" },
    pattern(c, col) {
      // Three white bands, each edged with a thin black line.
      const bands = [
        [[.29, -.3], [.245, 0], [.28, .28], [.2, .28], [.17, 0], [.2, -.3]],
        [[.03, -.31], [.11, -.03], [.03, .27], [-.08, .27], [-.02, -.03], [-.08, -.31]],
        [[-.39, -.16], [-.39, .16], [-.46, .16], [-.46, -.16]],
      ];
      for (const band of bands) {
        const p = curve(new Path2D(), band, true);
        c.fillStyle = col("#fbf6ec"); c.fill(p);
        c.strokeStyle = col("#1d1512", .9); c.lineWidth = .016; c.stroke(p);
      }
    },
  },
  // Palette surgeonfish (blue tang).
  tang: {
    body: [[.5, .03, .035], [.46, -.06, .1], [.37, -.18, .2], [.2, -.255, .255], [0, -.265, .265], [-.2, -.225, .22], [-.37, -.13, .12], [-.5, -.06, .055]],
    eye: [.35, -.07, .05], mouth: [.5, .033], gill: .25,
    dorsal: { edge: [[.31, -.2], [.24, -.28], [.12, -.33], [0, -.345], [-.12, -.34], [-.24, -.3], [-.34, -.22], [-.42, -.1]], line: "#10141c", lineWidth: 2 },
    anal: { edge: [[.06, .25], [-.05, .32], [-.17, .335], [-.28, .29], [-.37, .2], [-.43, .085]], line: "#10141c", lineWidth: 2 },
    caudal: { edge: [[0, -.055], [-.08, -.13], [-.2, -.24], [-.34, -.33], [-.27, -.16], [-.22, 0], [-.27, .16], [-.34, .33], [-.2, .24], [-.08, .13], [0, .055]], color: "#f2c64a", line: "#10141c", lineWidth: 2.4 },
    pectoral: { at: [.2, .05], edge: [[0, -.03], [-.09, -.06], [-.2, -.05], [-.24, 0], [-.19, .045], [-.09, .05], [0, .03]], angle: .15, tip: "#f2c64a" },
    pelvic: { at: [.16, .22], edge: [[0, -.01], [-.04, .05], [-.1, .08], [-.07, .03], [-.02, 0]] },
    pattern(c, col) {
      // The black "palette" runs from the eye along the back to the tail and
      // loops down around an oval of blue.
      c.fillStyle = col("#10141c");
      c.fill(curve(new Path2D(), [[.4, -.06], [.3, -.19], [.12, -.255], [-.1, -.25], [-.3, -.19], [-.46, -.1], [-.56, -.03], [-.56, .05], [-.44, .07], [-.3, .1], [-.14, .15], [0, .14], [.1, .06], [.15, -.03], [.24, -.05], [.33, -.02]], true));
      c.fillStyle = col("#2f62c2"); oval(c, -.14, -.065, .19, .085, -.08);
      c.fillStyle = col("#3d6fcc", .9); oval(c, -.5, .0, .05, .03);
    },
  },
  // Queen angelfish.
  angel: {
    body: [[.5, .04, .06], [.46, -.06, .14], [.38, -.2, .24], [.24, -.31, .31], [.05, -.34, .33], [-.15, -.31, .3], [-.33, -.2, .2], [-.5, -.085, .085]],
    eye: [.37, -.04, .05], mouth: [.5, .05], gill: .29,
    dorsal: { edge: [[.27, -.3], [.18, -.4], [.05, -.45], [-.1, -.47], [-.25, -.47], [-.4, -.45], [-.55, -.43], [-.72, -.41], [-.86, -.38], [-.62, -.3], [-.5, -.18], [-.47, -.09]], line: "#4fb2f0", lineWidth: 1.6, flow: true },
    anal: { edge: [[.03, .32], [-.08, .42], [-.22, .46], [-.38, .46], [-.55, .44], [-.72, .42], [-.84, .39], [-.6, .3], [-.5, .18], [-.47, .09]], line: "#4fb2f0", lineWidth: 1.6, flow: true },
    caudal: { edge: [[0, -.085], [-.06, -.18], [-.18, -.24], [-.27, -.2], [-.29, 0], [-.27, .2], [-.18, .24], [-.06, .18], [0, .085]], color: "#f4c530" },
    pectoral: { at: [.22, .06], edge: [[0, -.03], [-.08, -.06], [-.18, -.05], [-.22, 0], [-.18, .045], [-.08, .055], [0, .03]], color: "#f4c530", angle: .2 },
    pelvic: { at: [.2, .27], edge: [[0, -.01], [-.06, .1], [-.2, .25], [-.12, .08], [-.04, 0]], color: "#f4c530" },
    pattern(c, col) {
      // Scales with yellow centers, a blue face, and the crown on the forehead.
      c.fillStyle = col("#e9c94a", .42);
      for (let y = -.32, row = 0; y < .34; y += .045, row++) for (let x = -.48 + (row & 1) * .022; x < .32; x += .045) dot(c, x + Math.sin(x * 91 + y * 37) * .006, y + Math.cos(x * 53 - y * 71) * .006, .011);
      const face = c.createRadialGradient(.42, .02, 0, .42, .02, .22);
      face.addColorStop(0, col("#3f74b8", .75)); face.addColorStop(1, col("#3f74b8", 0));
      c.fillStyle = face; c.fillRect(.15, -.3, .4, .6);
      c.strokeStyle = col("#4fb2f0", .9); c.lineWidth = .014;
      c.beginPath(); c.arc(.31, .02, .14, -1.2, 1.3); c.stroke();
      c.fillStyle = col("#4fb2f0"); dot(c, .25, -.235, .055);
      c.fillStyle = col("#15245a"); dot(c, .25, -.235, .042);
      c.fillStyle = col("#4fb2f0"); dot(c, .25, -.235, .012);
    },
  },
  // Valentini's sharpnose puffer.
  puffer: {
    body: [[.5, .025, .04], [.45, -.06, .1], [.33, -.18, .2], [.15, -.25, .25], [-.05, -.245, .25], [-.25, -.17, .19], [-.4, -.1, .11], [-.5, -.075, .075]],
    eye: [.28, -.1, .066], mouth: [.5, .033], gill: .17,
    dorsal: { edge: [[-.22, -.18], [-.25, -.27], [-.31, -.29], [-.36, -.21], [-.37, -.13]], ripple: true },
    anal: { edge: [[-.24, .18], [-.27, .27], [-.33, .28], [-.37, .2], [-.38, .13]], ripple: true },
    caudal: { edge: [[0, -.075], [-.07, -.15], [-.18, -.19], [-.26, -.15], [-.29, 0], [-.26, .15], [-.18, .19], [-.07, .15], [0, .075]], color: "#f1d27e", line: "#d98a3a" },
    pectoral: { at: [.15, .0], edge: [[0, -.025], [-.06, -.045], [-.12, -.03], [-.13, .01], [-.09, .035], [-.04, .035], [0, .02]], angle: .1 },
    pattern(c, col) {
      // Four brown saddles, orange spots low on the body, and fine blue-green
      // lines around the eye.
      c.fillStyle = col("#3b2a21");
      for (const s of [[[.36, -.2], [.2, -.27], [.18, -.1], [.3, -.05]], [[.1, -.3], [-.1, -.3], [-.12, .1], [-.02, .2], [.08, .08]], [[-.17, -.25], [-.31, -.2], [-.3, .03], [-.2, .08]], [[-.39, -.13], [-.5, -.1], [-.5, .02], [-.41, .0]]]) c.fill(curve(new Path2D(), s, true));
      c.fillStyle = col("#d27a33");
      for (const [x, y] of [[.38, .1], [.3, .15], [.22, .19], [.16, .12], [.05, .2], [-.08, .22], [-.2, .16], [-.28, .1], [-.36, .07], [.42, .03], [.12, .22]]) dot(c, x, y, .022);
      c.strokeStyle = col("#47b3a6", .9); c.lineWidth = .012;
      for (let i = 0; i < 7; i++) { const a = -.6 + i * .52, [ex, ey] = [.28, -.1]; c.beginPath(); c.moveTo(ex + Math.cos(a) * .08, ey + Math.sin(a) * .08); c.lineTo(ex + Math.cos(a) * .12, ey + Math.sin(a) * .12); c.stroke(); }
    },
  },
};

// A generic fish body for species without a look of their own yet.
const PLAIN = {
  body: [[.5, .01, .02], [.45, -.08, .08], [.33, -.17, .16], [.15, -.21, .2], [-.05, -.2, .19], [-.25, -.15, .14], [-.4, -.09, .08], [-.5, -.065, .06]],
  eye: [.33, -.05, .055], mouth: [.5, .015], gill: .21,
  dorsal: { edge: [[.18, -.2], [.08, -.28], [-.08, -.29], [-.22, -.25], [-.33, -.13]] },
  anal: { edge: [[-.12, .18], [-.18, .26], [-.28, .24], [-.35, .1]] },
  caudal: { edge: [[0, -.06], [-.1, -.15], [-.3, -.26], [-.25, 0], [-.3, .26], [-.1, .15], [0, .06]] },
  pectoral: { at: [.18, .04], edge: [[0, -.02], [-.08, -.045], [-.16, -.03], [-.17, .01], [-.08, .035], [0, .02]], angle: .2 },
};

const built = new Map();

// shape turns a look into paths, once.
function shape(look) {
  let s = built.get(look);
  if (s) return s;
  const top = x => station(look.body, x, 1), bottom = x => station(look.body, x, 2);
  const outline = [[look.body[0][0], (look.body[0][1] + look.body[0][2]) / 2], ...look.body.slice(1).map(([x, t]) => [x, t]), ...look.body.slice(1).reverse().map(([x, , b]) => [x, b])];
  s = { body: curve(new Path2D(), outline, true), top: Math.min(...look.body.map(b => b[1])), bottom: Math.max(...look.body.map(b => b[2])) };
  s.dorsal = look.dorsal && edgeFin(look.dorsal, x => top(x) + .025);
  s.anal = look.anal && edgeFin(look.anal, x => bottom(x) - .025);
  s.caudal = baseFin(look.caudal, [0, 0], true);
  s.pectoral = baseFin(look.pectoral, [0, 0]);
  s.pelvic = look.pelvic && baseFin(look.pelvic, [0, 0]);
  // Scales overlap from head to tail, so each shows a rim toward the tail.
  s.scales = new Path2D();
  for (let y = -.34, row = 0; y < .36; y += .05, row++) for (let x = -.47 + (row & 1) * .025; x < look.gill - .02; x += .05) { s.scales.moveTo(x - .03 * Math.cos(1), y - .03 * Math.sin(1)); s.scales.arc(x, y, .03, Math.PI + 1, Math.PI - 1, true); }
  const [ex] = look.eye;
  s.gill = new Path2D(); s.gill.moveTo(look.gill + .02, top(look.gill) * .7); s.gill.quadraticCurveTo(look.gill - .05, 0, look.gill + .01, bottom(look.gill) * .75);
  s.line = new Path2D(); s.line.moveTo(look.gill - .02, top(look.gill) * .5); s.line.quadraticCurveTo(0, top(0) * .62, -.46, -.01);
  s.rim = curve(new Path2D(), look.body.slice(1).map(([x, t]) => [x, t + .006]));
  // Bounds of everything, for fitting portraits.
  const pts = [...outline, ...(look.dorsal?.edge || []), ...(look.anal?.edge || []), ...look.caudal.edge.map(([x, y]) => [x - .5, y]), ...(look.pelvic ? look.pelvic.edge.map(([x, y]) => [x + look.pelvic.at[0], y + look.pelvic.at[1]]) : [])];
  s.bounds = { x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0]), ex), y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1])) };
  built.set(look, s);
  return s;
}

function station(body, x, k) {
  for (let i = 1; i < body.length; i++) if (x >= body[i][0]) { const a = body[i - 1], b = body[i], t = (x - b[0]) / (a[0] - b[0] || 1); return lerp(b[k], a[k], t); }
  return body[body.length - 1][k];
}

// edgeFin builds a fin whose base follows the body edge.
function edgeFin(fin, base) {
  const e = fin.edge, n = e.length, x0 = e[0][0], x1 = e[n - 1][0];
  const path = curve(new Path2D(), e);
  for (let i = 0; i <= 8; i++) { const x = lerp(x1, x0, i / 8); path.lineTo(x, base(x)); }
  path.closePath();
  const rays = new Path2D();
  for (let i = 1; i < n - 1; i++) { const x = lerp(x0, x1, i / (n - 1)); rays.moveTo(x, base(x)); rays.lineTo(e[i][0], e[i][1]); }
  const far = e.reduce((a, p) => Math.abs(p[1] - base(p[0])) > Math.abs(a[1] - base(a[0])) ? p : a);
  return { ...fin, path, rays, rim: curve(new Path2D(), e), from: [far[0], base(far[0])], to: far };
}

// baseFin builds a fin that fans out from one base point.
function baseFin(fin, [bx, by], tail = false) {
  const e = fin.edge, path = curve(new Path2D(), e, true), rays = new Path2D();
  for (let i = 1; i < e.length - 1; i++) {
    const from = tail ? [0, lerp(e[0][1], e[e.length - 1][1], i / (e.length - 1))] : [bx, by];
    rays.moveTo(from[0], from[1]); rays.lineTo(e[i][0], e[i][1]);
  }
  const far = e.reduce((a, p) => Math.hypot(p[0] - bx, p[1] - by) > Math.hypot(a[0] - bx, a[1] - by) ? p : a);
  return { ...fin, path, rays, rim: curve(new Path2D(), tail ? e.slice(1, -1) : e), from: [bx, by], to: [tail ? far[0] : far[0], tail ? 0 : far[1]] };
}

// paint draws a fin: a see-through membrane, its rays and an optional rim.
function paint(c, fin, color, col, alpha, hair) {
  const hue = fin.color || color, g = c.createLinearGradient(fin.from[0], fin.from[1], fin.to[0], fin.to[1]);
  g.addColorStop(0, col(hue, alpha)); g.addColorStop(.6, col(hue, alpha * .82, .06)); g.addColorStop(1, col(hue, alpha * .5, .14));
  c.fillStyle = g; c.fill(fin.path);
  c.strokeStyle = col(hue, alpha * .55, -.3); c.lineWidth = hair * .6; c.stroke(fin.rays);
  if (fin.tip) { c.save(); c.clip(fin.path); c.fillStyle = col(fin.tip, alpha + .1); c.fillRect(-.3, -.2, .16, .4); c.restore(); }
  if (fin.line) { c.strokeStyle = col(fin.line, .85); c.lineWidth = hair * (fin.lineWidth || 1.2); c.stroke(fin.rim); }
}

// draw paints a fish in unit space for the given pose.
function draw(c, look, s, pose, haze, L) {
  const col = shade(haze), C = pose.colors, hair = 1 / L;
  // The tail sweeps toward and away from us, so seen from the side it
  // narrows and twists rather than swinging up and down.
  const sweep = 1 - .55 * pose.beat * Math.sin(pose.tail) ** 2;
  c.save(); c.translate(-.5, 0); c.transform(sweep, Math.sin(pose.tail) * .12 * pose.beat, 0, 1, 0, 0);
  paint(c, s.caudal, C.fin, col, .72 + .22 * (1 - sweep), hair);
  c.restore();
  for (const [fin, sign] of [[s.dorsal, -1], [s.anal, 1]]) {
    if (!fin) continue;
    c.save();
    if (fin.flow) { c.translate(-.4, 0); c.rotate(Math.sin(pose.fin * .5) * .025 * sign); c.translate(.4, 0); }
    if (fin.ripple) { const x0 = fin.edge[0][0]; c.translate(x0, 0); c.transform(1, 0, Math.sin(pose.fin * 1.6) * .35, 1, 0, 0); c.translate(-x0, 0); }
    paint(c, fin, C.fin, col, .86, hair);
    c.restore();
  }
  if (s.pelvic) { c.save(); c.translate(...look.pelvic.at); c.rotate(-.1 + Math.sin(pose.fin * .7) * .08); c.translate(.05, 0); paint(c, s.pelvic, C.fin, col, .55, hair); c.restore(); }
  // Body: lighter below than above, then the species' markings, scales, and
  // the light from the surface.
  const g = c.createLinearGradient(0, s.top, 0, s.bottom);
  g.addColorStop(0, col(C.back)); g.addColorStop(.48, col(C.flank)); g.addColorStop(1, col(C.belly));
  c.fillStyle = g; c.fill(s.body);
  c.save(); c.clip(s.body);
  look.pattern?.(c, col, pose);
  if (L > 24) { c.strokeStyle = col("#0e1c22", .07); c.lineWidth = hair * .7; c.stroke(s.scales); }
  c.strokeStyle = col("#ffffff", .1); c.lineWidth = hair * .8; c.stroke(s.line);
  c.strokeStyle = col(C.back, .45, -.4); c.lineWidth = hair * 1.1; c.save(); c.translate(Math.sin(pose.breath) * .006, 0); c.stroke(s.gill); c.restore();
  const light = c.createLinearGradient(0, s.top, 0, s.bottom);
  light.addColorStop(0, `rgba(255,255,255,${.24 * (1 - haze)})`); light.addColorStop(.32, `rgba(255,255,255,${.05 * (1 - haze)})`);
  light.addColorStop(.62, "rgba(255,255,255,0)"); light.addColorStop(1, "rgba(4,22,30,.24)");
  c.fillStyle = light; c.fillRect(-.6, s.top, 1.2, s.bottom - s.top);
  c.restore();
  c.strokeStyle = `rgba(255,255,255,${.22 * (1 - haze)})`; c.lineWidth = hair * .9; c.stroke(s.rim);
  // Eye, with a glint from above.
  const [ex, ey, er] = look.eye;
  c.fillStyle = col("#0d0b0a", .45); dot(c, ex, ey, er * 1.1);
  const iris = c.createRadialGradient(ex, ey - er * .3, er * .2, ex, ey, er);
  iris.addColorStop(0, col(C.iris, 1, .25)); iris.addColorStop(1, col(C.iris, 1, -.35));
  c.fillStyle = iris; dot(c, ex, ey, er);
  c.fillStyle = "#050505"; dot(c, ex + pose.lookX * er * .2, ey + pose.lookY * er * .16, er * .62);
  c.fillStyle = `rgba(255,255,255,${.8 * (1 - haze * .6)})`; dot(c, ex + er * .28, ey - er * .34, er * .2);
  // Mouth, which opens for a bite.
  const [mx, my] = look.mouth;
  c.strokeStyle = col(C.back, .7, -.5); c.lineWidth = hair; c.beginPath(); c.moveTo(mx - .005, my); c.lineTo(mx - .055, my + .012); c.stroke();
  if (pose.gape > 0) { c.fillStyle = col("#2a1712", .85 * pose.gape); oval(c, mx - .01, my + .006, .028, .022 * pose.gape); }
  // The near pectoral fin rows over the body.
  const p = look.pectoral;
  c.save(); c.translate(...p.at); c.rotate(p.angle + Math.sin(pose.fin) * .4 * pose.paddle); c.scale(.6 + .4 * Math.abs(Math.cos(pose.fin)), 1);
  paint(c, s.pectoral, C.fin, col, .42, hair);
  c.restore();
}

const STILL = { tail: 0, beat: .2, fin: 1.2, breath: 0, gape: 0, lookX: .3, lookY: 0, paddle: .4 };

// Fish swim with their tails, row with their fins while hovering, keep their
// distance from each other and turn around with a visible pivot.
export class Fish {
  constructor(spec, world, { enter = false } = {}) {
    this.spec = spec;
    this.look = LOOKS[spec.id] || PLAIN;
    this.shape = shape(this.look);
    this.seed = hash(spec.id);
    this.rand = random(this.seed ^ 0x9e3779b9);
    this.colors = spec.colors;
    const r = random(this.seed);
    this.z = .15 + r() * .55;
    this.facing = r() < .5 ? -1 : 1;
    this.x = world.width * (.15 + r() * .7);
    this.homeX = this.x;
    this.y = world.height * lerp(spec.zone[0], spec.zone[1], .3 + r() * .4);
    if (enter) { this.x = this.facing > 0 ? -world.width * .08 : world.width * 1.08; }
    this.vx = 0; this.vy = 0; this.pitch = 0; this.turn = 0; this.turnTo = this.turnFrom = this.facing;
    this.tail = r() * TAU; this.fin = r() * TAU; this.breath = r() * TAU;
    this.beat = .3; this.burst = 0; this.gape = 0; this.lookX = .2; this.lookY = 0; this.paddle = .5;
    this.mode = enter ? "swim" : "hover"; this.until = 0; this.goal = null; this.meal = 0; this.appetite = 0;
  }

  size(world) { return this.spec.length * world.px * (1 - .3 * this.z); }

  resize(sx, sy) { this.x *= sx; this.y *= sy; this.goal = null; }

  // pick chooses the next place to swim to inside the species' zone.
  pick(world, L) {
    const s = this.spec, W = world.width, H = world.height;
    if (s.home) {
      const h = world.home(this.homeX), r = Math.max(L * 2.2, W * .1);
      const x = clamp(h.x + (this.rand() * 2 - 1) * r, L, W - L);
      return [x, clamp(h.y + (this.rand() * 2 - 1) * r * .5, H * .12, world.ground(x, this.z) - L * .45)];
    }
    const rock = s.rocky ? world.rocks[Math.floor(this.rand() * world.rocks.length)] : null;
    const x = rock ? clamp(rock.x + (this.rand() * 2 - 1) * W * .15, L, W - L) : L + this.rand() * (W - 2 * L);
    return [x, Math.min(H * lerp(s.zone[0], s.zone[1], this.rand()), world.ground(x, this.z) - L * .45)];
  }

  // hunt finds the nearest sinking pellet and bites it when close enough;
  // after a few bites a fish loses interest and leaves the rest to sink.
  hunt(world, L) {
    if (this.meal !== world.meal) { this.meal = world.meal; this.appetite = 2 + Math.floor(this.rand() * 2); }
    if (this.appetite <= 0) return null;
    let best = null, bd = Infinity;
    for (const p of world.pellets) {
      if (p.landed || p.eaten || p.alpha < 1) continue;
      const d = Math.hypot(p.x - (this.x + this.facing * L * .5), p.y - this.y);
      if (d < bd) { bd = d; best = p; }
    }
    if (best && Math.hypot(this.x + this.facing * L * .5 - best.x, this.y - best.y) < L * .18) { world.eat(best); this.gape = 1; this.appetite--; }
    return best && !best.eaten ? best : null;
  }

  step(dt, world) {
    const s = this.spec, L = this.size(world), W = world.width, H = world.height, t = world.time;
    this.z = follow(this.z, .1 + .65 * (noise(this.seed, t * .025) * .5 + .5), .2, dt);
    const cruise = s.speed * L;
    let goal = null, speed = cruise;
    const food = this.hunt(world, L);
    if (food) { goal = [food.x - this.facing * L * .45, food.y]; speed = cruise * 1.8; this.mode = "swim"; this.goal = null; }
    else {
      if (this.mode === "hover" && t > this.until) { this.mode = "swim"; this.goal = this.pick(world, L); }
      if (this.mode === "swim") {
        if (!this.goal) this.goal = this.pick(world, L);
        if (Math.hypot(this.goal[0] - this.x, this.goal[1] - this.y) < L * .6) {
          if (this.rand() < s.hover) { this.mode = "hover"; this.until = t + 2 + this.rand() * 6; this.goal = null; }
          else this.goal = this.pick(world, L);
        }
        goal = this.goal;
      }
    }
    let dvx, dvy;
    if (goal) {
      const dx = goal[0] - this.x, dy = goal[1] - this.y, d = Math.hypot(dx, dy) || 1;
      const v = speed * clamp(d / (L * 1.6), .3, 1) * (1 + this.burst * .9);
      dvx = dx / d * v; dvy = dy / d * v * .6;
    } else {
      dvx = noise(this.seed + 3, t * .4) * L * .12; dvy = noise(this.seed + 5, t * .3) * L * .08;
    }
    // Keep a polite distance from fish at a similar depth, or pass at another depth.
    for (const o of world.fish) {
      if (o === this || Math.abs(o.z - this.z) > .25) continue;
      const ox = this.x - o.x, oy = this.y - o.y, d = Math.hypot(ox, oy) || 1, near = (L + o.size(world)) * .75;
      if (d < near) {
        const push = (near - d) / near;
        dvx += ox / d * push * cruise * 3.5; dvy += oy / d * push * cruise * 5;
        // Crowded at the same depth, one drifts in front and the other behind.
        this.z = clamp(this.z + (Math.sign(this.z - o.z) || (this.seed > o.seed ? 1 : -1)) * push * .8 * dt, 0, .9);
      }
    }
    // Stay in the water and inside the glass.
    const floor = world.ground(this.x, this.z) - L * .3;
    if (this.y > floor) dvy -= (this.y - floor) * 3;
    if (this.y < H * .08) dvy += (H * .08 - this.y) * 3;
    if (this.x < L * .6) dvx += (L * .6 - this.x) * 2;
    if (this.x > W - L * .6) dvx -= (this.x - W + L * .6) * 2;
    const accel = cruise * 2.4;
    let ax = clamp((dvx - this.vx) * 2.2, -accel, accel);
    const ay = clamp((dvy - this.vy) * 2.2, -accel, accel);
    if (this.turn > 0 && this.turn < .5) ax = -this.vx * 3;
    this.vx += ax * dt; this.vy += ay * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    // Face the way it swims; hovering fish may face into the current or look around.
    let want = this.facing;
    if (Math.abs(this.vx) > L * .25) want = Math.sign(this.vx);
    else if (this.mode === "hover" && !food) {
      if (s.upstream) want = -1;
      else if (s.curious) want = noise(this.seed + 9, t * .12) > .1 ? 1 : -1;
    }
    if (!this.turn && want !== this.facing) { this.turn = 1e-3; this.turnTo = want; this.turnFrom = this.facing; }
    if (this.turn) { this.turn += dt / .5; if (this.turn >= .5) this.facing = this.turnTo; if (this.turn >= 1) this.turn = 0; }
    this.pitch = follow(this.pitch, clamp(Math.atan2(this.vy, Math.abs(this.vx) + L * .3), -.35, .35), 3, dt);
    // Fins: thrust drives the tail; slow fish row with their pectorals.
    const pace = Math.hypot(this.vx, this.vy) / cruise, push = Math.max(0, ax * this.facing) / accel;
    let beat = clamp(.14 + pace * .5 + push * .7 + this.burst * .5, .12, 1);
    if (s.propulsion === "pectoral") beat *= pace > 1.1 ? .9 : .35;
    if (s.propulsion === "fins") beat *= pace > 1.2 ? .8 : .15;
    this.beat = follow(this.beat, beat, 4, dt);
    this.tail += TAU * (1 + 2.4 * this.beat * (s.wiggle ? 1.45 : 1)) * dt;
    const rowing = pace < .4 || s.propulsion !== "tail";
    this.paddle = follow(this.paddle, rowing ? 1 : .35, 3, dt);
    this.fin += TAU * (rowing ? 2.2 : 1.1) * dt;
    this.breath += TAU * 1.2 * dt;
    if (s.burst) { this.burst = follow(this.burst, 0, 1.4, dt); if (this.mode === "swim" && this.rand() < dt * .45) this.burst = 1; }
    this.gape = Math.max(0, this.gape - dt * 3);
    this.lookX = s.curious ? noise(this.seed + 11, t * .5) : .2; this.lookY = s.curious ? noise(this.seed + 13, t * .4) : 0;
  }

  draw(c, world) {
    const L = this.size(world), haze = this.z * .5;
    c.save();
    c.translate(this.x, this.y);
    if (!this.turn) {
      c.scale(this.facing, 1);
      c.rotate(this.pitch + (this.spec.wiggle ? Math.sin(this.tail) * .05 * this.beat : 0));
      c.scale(L, L);
      draw(c, this.look, this.shape, this, haze, L);
    } else {
      // Turning, the body bends: the head swings round first and the tail
      // follows, each half foreshortened as it points toward us.
      const p = this.turn, bend = (from) => { const v = Math.cos(Math.PI * clamp(p * 1.5 - from, 0, 1)); return Math.sign(v || 1) * Math.max(.16, Math.abs(v)); };
      c.scale(this.turnFrom, 1);
      c.rotate(this.pitch);
      for (const [half, scale] of [[-1, bend(.5)], [1, bend(0)]]) {
        c.save(); c.scale(scale * L, L);
        c.beginPath(); c.rect(half < 0 ? -2 : 0, -2, 2, 4); c.clip();
        draw(c, this.look, this.shape, this, haze, L);
        c.restore();
      }
    }
    c.restore();
  }

  // portrait paints a still fish filling a w × h box.
  static portrait(c, spec, w, h) {
    const look = LOOKS[spec.id] || PLAIN, s = shape(look), b = s.bounds;
    const L = Math.min(w * .92 / (b.x1 - b.x0), h * .9 / (b.y1 - b.y0));
    c.save(); c.translate(w / 2 - (b.x0 + b.x1) / 2 * L, h / 2 - (b.y0 + b.y1) / 2 * L); c.scale(L, L);
    draw(c, look, s, { ...STILL, colors: spec.colors }, 0, L);
    c.restore();
  }
}
