// theme.ts binds theme tokens from themes/<id>/theme.json onto CSS variables
// on :root and exposes globalThis.THEME for canvas drawing code. Unspecified
// tokens fall back to reef-realistic, so every theme is a self-contained
// override layer on top of the default contract.

export interface CreatureColor {
  color: string;
  stages?: number;
}

export type TokenValue = string | CreatureColor;

export interface ThemeFonts {
  title?: string;
  body?: string;
  digits?: string;
}

export interface ThemeControls {
  radius?: string;
  borderWidth?: string;
}

export interface ThemeBehavior {
  maxCreatures: number;
}

export interface Theme {
  meta?: {
    themeId?: string;
    displayName?: string;
    styleFamily?: string;
    version?: string;
    minAppVersion?: string;
    supportsDarkAppearance?: boolean;
    reduceMotionFallback?: string;
  };
  tokens: Record<string, TokenValue | undefined>;
  motion: Record<string, number | string | undefined>;
  ambientAudio: Record<string, unknown>;
  controls: ThemeControls;
  fonts: ThemeFonts;
  behavior: ThemeBehavior;
  creaturePalette?: { fish?: string; [key: string]: string | undefined };
}

declare global {
  // eslint-disable-next-line no-var
  var THEME: Theme | undefined;
}

const BASE = "reef-realistic";

// Maps each design token onto the CSS variable it rebinds on :root.
const VAR_MAP: Record<string, string> = {
  bgBase: "--bg",
  bgGradient: "--bg-gradient",
  bgGlow: "--bg-glow",
  waterLight: "--water-light",
  sand: "--sand",
  coral: "--coral",
  fish: "--fish",
  seaweed: "--seaweed",
  bubble: "--bubble",
  accent: "--accent",
  accentInk: "--accent-ink",
  timerActive: "--timer-active",
  timerPause: "--timer-pause",
  controlBg: "--panel",
  controlBorder: "--line",
  panelDeep: "--panel-deep",
  panelRaised: "--panel-raised",
  fieldBg: "--field-bg",
  activeBg: "--active-bg",
  activeBorder: "--active-border",
  ringTrack: "--ring-track",
  hoverBg: "--hover-bg",
  popBg: "--pop-bg",
  textPrimary: "--text",
  textSecondary: "--muted",
  textFaint: "--text-faint",
  menuIcon: "--menu-icon",
};

let applied = "";
let themeFadeTimer: ReturnType<typeof setTimeout> | undefined;

async function loadThemeFile(id: string): Promise<Theme> {
  const res = await fetch(`/themes/${id}/theme.json`);
  if (!res.ok) throw new Error(`主题 ${id} 读取失败`);
  return (await res.json()) as Theme;
}

// colorOf flattens a token that may be a plain hex string or a
// {color, stages} creature-color record.
function colorOf(value: TokenValue | undefined): string | undefined {
  return value && typeof value === "object" ? value.color : (value as string | undefined);
}

// loadTheme merges a theme onto reef-realistic so omitted tokens inherit.
async function loadTheme(id: string): Promise<Theme> {
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
export async function applyTheme(id: string): Promise<void> {
  if (!id || applied === id) return;
  const theme = await loadTheme(id);
  const root = document.documentElement.style;
  for (const [token, cssVar] of Object.entries(VAR_MAP)) {
    if (theme.tokens[token] === undefined) continue;
    root.setProperty(cssVar, colorOf(theme.tokens[token]) as string);
  }
  globalThis.THEME = theme;
  // Controls geometry and font stacks are theme-level too: rebind the same
  // way, so family constants never live in JS conditionals.
  if (theme.controls?.radius) root.setProperty("--radius", theme.controls.radius);
  if (theme.controls?.borderWidth) root.setProperty("--control-border-width", theme.controls.borderWidth);
  if (theme.fonts?.title) root.setProperty("--font-title", theme.fonts.title);
  if (theme.fonts?.digits) root.setProperty("--font-digits", theme.fonts.digits);
  applied = id;
  // Light themes opt out of the system dark palette: native widgets
  // (scrollbars, checkboxes, inputs) follow the theme, not the OS.
  root.setProperty("color-scheme", theme.meta?.supportsDarkAppearance === false ? "light" : "dark");
  if (typeof document !== "undefined" && document.querySelector) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && theme.tokens.bgBase) meta.setAttribute("content", colorOf(theme.tokens.bgBase) as string);
  }
  // Cross-fade the themed surfaces for 600ms; "减少动态效果" users get a hard cut.
  if (
    typeof document !== "undefined" &&
    document.body &&
    typeof matchMedia === "function" &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    document.body.classList.add("theme-fading");
    clearTimeout(themeFadeTimer);
    themeFadeTimer = setTimeout(() => document.body!.classList.remove("theme-fading"), 600);
  }
  window.dispatchEvent(new CustomEvent("theme:changed"));
}

// currentTheme lets canvas code read the live palette and motion gates.
export function currentTheme(): Theme | null {
  return globalThis.THEME || null;
}

// themeColor resolves one token for canvas code, falling back to the shipped
// literal so the default reef looks exactly like before theming existed.
export function themeColor(token: string, fallback: string): string {
  const v = colorOf(globalThis.THEME?.tokens?.[token]);
  return v || fallback;
}

// themeMotion returns a gate multiplier (1.0 for the default theme).
export function themeMotion(name: string, fallback = 1): number {
  const v = globalThis.THEME?.motion?.[name];
  return typeof v === "number" ? v : fallback;
}
