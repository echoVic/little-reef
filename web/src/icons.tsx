import type { ComponentType } from "react";
import {
  Anchor, AudioLines, Car, Check, CircleDot, Clock, CloudLightning, CloudRain,
  Coffee, Droplets, Fish, Flame, Maximize2, Moon, Mountain, Music,
  PanelsTopLeft, Pause, Play, Soup, Sparkles, Sun, Sunrise, Trees, Volume2, VolumeX,
  Waves, Wind, X,
} from "lucide-react";

// Closed logical-name registry: components choose a name, never inline SVG.
// Mirrors the original icons.js contract, now backed by lucide-react.
export const ICONS = {
  compact: PanelsTopLeft,
  close: X,
  check: Check,
  play: Play,
  pause: Pause,
  coffee: Coffee,
  expand: Maximize2,
  volume: Volume2,
  muted: VolumeX,
  fish: Fish,
  // The 20 ambient sounds, in the order the settings panel renders them.
  waves: Waves,
  rain: CloudRain,
  thunder: CloudLightning,
  stream: Droplets,
  bubbles: Sparkles,
  boil: Soup,
  deepsea: Anchor,
  wind: Wind,
  fire: Flame,
  forest: Trees,
  summer: Sun,
  night: Moon,
  desert: Mountain,
  morning: Sunrise,
  clock: Clock,
  knock: CircleDot,
  cafe: Coffee,
  musicbox: Music,
  traffic: Car,
  pink: AudioLines,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16 }: { name: IconName | string; size?: number }) {
  const Cmp = (ICONS as Record<string, ComponentType<{ size?: number }>>)[name];
  if (!Cmp) return null;
  return <Cmp size={size} />;
}
