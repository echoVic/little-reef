// Mirror of the Go Snapshot contract (state.go). Field names must match the
// JSON tags exactly; derived fields are omitempty on the wire, so they are
// optional here.
export interface Preferences {
  focusMinutes: number;
  breakMinutes: number;
  sound: string;
  volume: number;
  soundEnabled: boolean;
  chimeEnabled: boolean;
}

export type SessionStatus = "idle" | "running" | "paused" | "complete";
export type SessionKind = "focus" | "break";

export interface Session {
  id: number;
  kind: SessionKind | string;
  status: SessionStatus | string;
  task: string;
  durationMs: number;
  elapsedMs: number;
  startedAt: string;
}

export interface Record {
  id: number;
  task: string;
  seconds: number;
  completed: boolean;
  date: string;
}

export interface Visitor {
  species: string;
  name: string;
  date: string;
  visits: number;
}

export interface Snapshot {
  revision: number;
  preferences: Preferences;
  session: Session;
  completed: number;
  totalSecs: number;
  todaySecs: number;
  todayRounds: number;
  records: Record[];
  visitors: Visitor[];
  lastVisitor: string;
  notice: string;
  fedSession: number;
  nowMs: number;
  weekSecs?: number;
  weekRounds?: number;
  weekDays?: number;
  monthSecs?: number;
  monthRounds?: number;
  totalDays?: number;
  nextTierRounds?: number;
  theme?: string;
}

export interface ThemeInfo {
  id: string;
  displayName: string;
}

// A subset of the mygo-runtime global surface the app relies on.
export interface MyGoPreferences {
  reduceMotion?: boolean;
  [key: string]: unknown;
}

export interface MyGoRuntime {
  call: (method: string, ...args: unknown[]) => Promise<unknown>;
  on: (name: string, listener: (payload: unknown) => void) => () => void;
  preferences?: MyGoPreferences;
  window?: {
    minimize: () => Promise<void>;
    close: () => Promise<void>;
  };
  [key: string]: unknown;
}

declare global {
  // eslint-disable-next-line no-var
  var mygo: MyGoRuntime | undefined;
}
