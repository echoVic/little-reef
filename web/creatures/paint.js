// Colors and outline helpers shared by the creature models.
const parsed = new Map();

// rgb parses a "#rrggbb" color once.
export function rgb(hex) {
  let c = parsed.get(hex);
  if (!c) parsed.set(hex, c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  return c;
}

// Distance fades every color toward the water, the stage's middle tone.
const WATER = rgb("#173f4c");

// tone returns a CSS color: light (−1…1) darkens or lightens it first, then
// haze (0…1) fades it toward the water the way distance does.
export function tone(hex, haze = 0, alpha = 1, light = 0) {
  const c = rgb(hex);
  let r = c[0], g = c[1], b = c[2];
  if (light > 0) { r += (255 - r) * light; g += (255 - g) * light; b += (255 - b) * light; }
  else if (light < 0) { r *= 1 + light; g *= 1 + light; b *= 1 + light; }
  r += (WATER[0] - r) * haze; g += (WATER[1] - g) * haze; b += (WATER[2] - b) * haze;
  return `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;
}

// shade returns tone() bound to one creature's haze, so painters can write col(hex, alpha, light).
export function shade(haze) { return (hex, alpha = 1, light = 0) => tone(hex, haze, alpha, light); }

// curve adds a smooth line through points (Catmull-Rom as cubic Béziers) to a
// path or a context; closed curves wrap around to the first point.
export function curve(path, points, closed = false, move = true) {
  const n = points.length;
  const at = i => closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  if (move) path.moveTo(points[0][0], points[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    path.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) path.closePath();
  return path;
}

// limb strokes a jointed leg through points, thinning from base to tip.
export function limb(c, points, base, tip, color) {
  c.strokeStyle = color; c.lineCap = "round"; c.lineJoin = "round";
  for (let i = 1; i < points.length; i++) {
    c.lineWidth = base + (tip - base) * (i - 1) / Math.max(1, points.length - 2);
    c.beginPath(); c.moveTo(points[i - 1][0], points[i - 1][1]); c.lineTo(points[i][0], points[i][1]); c.stroke();
  }
}

// shadow lays the soft contact shadow under something resting on the sand.
export function shadow(c, x, y, rx, ry, alpha) {
  c.save(); c.translate(x, y); c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(8,22,20,${alpha})`); g.addColorStop(1, "rgba(8,22,20,0)");
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill(); c.restore();
}

// dot fills a circle.
export function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }

// oval fills an ellipse.
export function oval(c, x, y, rx, ry, rotation = 0) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rotation, 0, Math.PI * 2); c.fill(); }

// wind returns polygon points in clockwise order, so overlapping parts of
// one body add up when filled or clipped together.
export function wind(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) { const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % points.length]; area += x0 * y1 - x1 * y0; }
  return area < 0 ? points.slice().reverse() : points;
}

// hole draws a burrow opening with its ring of dug-out sand; lip redraws the
// front of the ring over whatever is still down in the burrow.
export function hole(c, x, y, r) {
  c.fillStyle = "#7f8e78"; oval(c, x, y, r * 1.6, r * .55);
  c.fillStyle = "#16201d"; oval(c, x, y - r * .06, r * .85, r * .3);
}
export function lip(c, x, y, r) {
  c.fillStyle = "#7f8e78"; c.beginPath(); c.ellipse(x, y, r * 1.6, r * .55, 0, 0, Math.PI); c.fill();
  c.fillStyle = "rgba(160,172,150,.5)"; c.beginPath(); c.ellipse(x, y + r * .05, r * 1.2, r * .32, 0, .2, Math.PI - .2); c.fill();
}
