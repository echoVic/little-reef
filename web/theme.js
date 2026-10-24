// theme.js binds theme tokens from web/themes/<id>/theme.json onto CSS
// variables on :root and exposes globalThis.THEME for canvas drawing code.
// Unspecified tokens fall back to reef-realistic, so every theme is a
// self-contained override layer on top of the default contract.

const BASE = "reef-realistic";

// Maps each design token onto the CSS variable it rebinds on :root.
const VAR_MAP = {
  bgBase: "--bg",
  bgGradient: "--bg-gradient",
  waterLight: "--water-light",
  sand: "--sand",
  coral: "--coral",
  fish: "--fish",
  seaweed: "--seaweed",
  bubble: "--bubble",
  accent: "--accent",
  timerActive: "--timer-active",
  timerPause: "--timer-pause",
  controlBg: "--panel",
  controlBorder: "--line",
  textPrimary: "--text",
  textSecondary: "--muted",
  menuIcon: "--menu-icon",
};

let applied = "";

async function loadThemeFile(id) {
  const res = await fetch(`/themes/${id}/theme.json`);
  if (!res.ok) throw new Error(`主题 ${id} 读取失败`);
  return res.json();
}

// colorOf flattens a token that may be a plain hex string or a
// {color, stages} creature-color record.
function colorOf(value) {
  return value && typeof value === "object" ? value.color : value;
}

// loadTheme merges a theme onto reef-realistic so omitted tokens inherit.
async function loadTheme(id) {
  const [base, own] = await Promise.all([loadThemeFile(BASE), loadThemeFile(id === BASE ? BASE : id)]);
  return {
    meta: own.meta,
    tokens: { ...base.tokens, ...own.tokens },
    motion: { ...base.motion, ...own.motion },
    ambientAudio: { ...base.ambientAudio, ...own.ambientAudio },
    controls: { ...base.controls, ...own.controls },
    fonts: { ...base.fonts, ...own.fonts },
    behavior: own.behavior || base.behavior,
    creaturePalette: own.creaturePalette || base.creaturePalette,
  };
}

// applyTheme rebinds CSS variables and refreshes the global THEME object;
// it never touches the saved archive, and repaints the reef immediately.
export async function applyTheme(id) {
  if (!id || applied === id) return;
  const theme = await loadTheme(id);
  const root = document.documentElement.style;
  for (const [token, cssVar] of Object.entries(VAR_MAP)) {
    if (theme.tokens[token] === undefined) continue;
    root.setProperty(cssVar, colorOf(theme.tokens[token]));
  }
  globalThis.THEME = theme;
  // Controls geometry and font stacks are theme-level too: rebind the same
  // way, so family constants never live in JS conditionals.
  if (theme.controls?.radius) root.setProperty("--radius", theme.controls.radius);
  if (theme.controls?.borderWidth) root.setProperty("--control-border-width", theme.controls.borderWidth);
  if (theme.fonts?.title) root.setProperty("--font-title", theme.fonts.title);
  if (theme.fonts?.digits) root.setProperty("--font-digits", theme.fonts.digits);
  applied = id;
  window.dispatchEvent(new CustomEvent("theme:changed"));
}

// currentTheme lets canvas code read the live palette and motion gates.
export function currentTheme() {
  return globalThis.THEME || null;
}

// themeColor resolves one token for canvas code, falling back to the shipped
// literal so the default reef looks exactly like before theming existed.
export function themeColor(token, fallback) {
  const v = colorOf(globalThis.THEME?.tokens?.[token]);
  return v || fallback;
}

// themeMotion returns a gate multiplier (1.0 for the default theme).
export function themeMotion(name, fallback = 1) {
  return globalThis.THEME?.motion?.[name] ?? fallback;
}
