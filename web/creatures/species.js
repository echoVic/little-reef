import { Fish } from "./fish.js";

// Every creature's model and habits. Lengths are in centimeters: the fish
// keep their true proportions, the bigger ones sized as young fish so
// nobody fills the tank; shrimp and crabs are drawn about half again their
// size so they stay readable on the sand. Colors are
// the species' own, a little muted to suit the quiet page. The ids match
// the visitor list in state.go.
const MODELS = { fish: Fish };

export const SPECIES = {
  // Lyretail anthias (sea goldfish), the resident who is always home.
  resident: { id: "resident", model: "fish", length: 8.5, zone: [.16, .6], speed: 1.1, hover: .35, burst: true, upstream: true, propulsion: "tail",
    colors: { back: "#df7a3e", flank: "#f09a54", belly: "#f8cf99", fin: "#f4a24f", iris: "#e9b45a" } },
  clown: { id: "clown", model: "fish", length: 7, zone: [.3, .85], speed: .9, hover: .5, home: true, wiggle: true, propulsion: "tail",
    colors: { back: "#dc6624", flank: "#ee8538", belly: "#f6a255", fin: "#ee8a3c", iris: "#f0a54a" } },
  tang: { id: "tang", model: "fish", length: 9.5, zone: [.12, .72], speed: 1, hover: .2, propulsion: "pectoral",
    colors: { back: "#1e4ead", flank: "#3367c6", belly: "#6c95d6", fin: "#2c5ab6", iris: "#22283a" } },
  angel: { id: "angel", model: "fish", length: 10, zone: [.38, .8], speed: .65, hover: .45, propulsion: "tail",
    colors: { back: "#2b6d80", flank: "#4f9a8e", belly: "#a7c77d", fin: "#3a8fa3", iris: "#d8b450" } },
  puffer: { id: "puffer", model: "fish", length: 6.5, zone: [.48, .88], speed: .5, hover: .6, curious: true, propulsion: "fins",
    colors: { back: "#e8d8be", flank: "#f2eadb", belly: "#fbf7ef", fin: "#f1dfab", iris: "#7dc6b4" } },
  cleaner: { id: "cleaner", model: "shrimp", length: 6.5, speed: .55, range: .12, rock: true, idle: 1.4 },
  fire: { id: "fire", model: "shrimp", length: 6, speed: .5, range: .1, rock: true, idle: 2 },
  harlequin: { id: "harlequin", model: "shrimp", length: 5.5, speed: .3, range: .14, rock: true, idle: 1.5 },
  pistol: { id: "pistol", model: "shrimp", length: 5.5, speed: .6, range: .08, burrow: true, idle: .8 },
  mantis: { id: "mantis", model: "mantis", length: 11, speed: .7, range: .14, burrow: true, idle: 1 },
  slipper: { id: "slipper", model: "shrimp", length: 9, speed: .25, range: .2, depths: [.15, .7], idle: 2.5 },
  hermit: { id: "hermit", model: "hermit", length: 4.5, speed: .45, range: .22, depths: [.1, .75], idle: 1.2 },
  emerald: { id: "emerald", model: "crab", length: 5.5, speed: .45, range: .1, rock: true, sideways: true, idle: 1.6 },
  porcelain: { id: "porcelain", model: "crab", length: 3.6, speed: .4, range: .06, rock: true, sideways: true, idle: 3 },
  arrow: { id: "arrow", model: "crab", length: 8, speed: .9, range: .14, rock: true, idle: 1.2 },
  swimmer: { id: "swimmer", model: "crab", length: 9, speed: .6, range: .25, depths: [.1, .7], sideways: true, idle: 1.4 },
};

// create returns a new creature, or null for an unknown species or one
// whose model is missing.
export function create(id, world, options) {
  const spec = SPECIES[id], Model = spec && MODELS[spec.model];
  return Model ? new Model(spec, world, options) : null;
}

// drawPortrait paints a still picture of a species into a canvas for the
// visitor book; unknown species get a plain silhouette.
export function drawPortrait(canvas, id) {
  const ratio = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
  canvas.width = Math.ceil(w * ratio); canvas.height = Math.ceil(h * ratio);
  const c = canvas.getContext("2d");
  c.setTransform(ratio, 0, 0, ratio, 0, 0);
  c.clearRect(0, 0, w, h);
  const spec = SPECIES[id], Model = spec && MODELS[spec.model];
  if (Model) { Model.portrait(c, spec, w, h); return; }
  c.fillStyle = "rgba(158,189,189,.35)";
  c.beginPath(); c.ellipse(w * .46, h / 2, w * .28, h * .2, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(w * .7, h / 2); c.lineTo(w * .86, h * .3); c.lineTo(w * .86, h * .7); c.fill();
}
