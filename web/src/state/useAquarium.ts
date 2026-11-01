import { useCallback, useEffect, useRef, useState } from "react";
import { call, desktop, subscribe, onAudioRequest, onUiRequest, onShortcutSettings } from "./bridge";
import { applyTheme } from "../theme/theme";
import { Soundscape } from "../audio/soundscape";
import { exportToast, importConfirm, importSuccess, downloadArchive } from "../backup/backup";
import type { Preferences, Snapshot, ThemeInfo, ShortcutSnapshot } from "./types";

export type SessionKind = "focus" | "break";

export function formatTime(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export interface TimerDerived {
  time: string;
  ringOffset: number;
  ringPaused: boolean;
  statusText: string;
  primaryLabel: string;
  primaryIcon: string;
  taskDisabled: boolean;
  taskPlaceholder: string;
  endHidden: boolean;
  footnote: string;
  feedDisabled: boolean;
  feedLabel: string;
  growthLabel: string;
  nextGrowth: string;
  caption: string;
}

export function deriveTimer(s: Snapshot, selectedKind: SessionKind): TimerDerived {
  const session = s.session;
  const p = s.preferences;
  const active = session.status === "running" || session.status === "paused";
  const chosenDuration = (selectedKind === "focus" ? p.focusMinutes : p.breakMinutes) * 60000;
  const sameKind = session.kind === selectedKind;
  const duration = active || (session.status === "complete" && sameKind) ? session.durationMs : chosenDuration;
  const elapsed = active || (session.status === "complete" && sameKind) ? session.elapsedMs : 0;
  const time = formatTime(duration - elapsed);
  const complete = session.status === "complete" && sameKind;

  let statusText = "准备好，就开始";
  if (active) statusText = session.status === "paused" ? "暂停一下，没关系" : session.kind === "focus" ? "小鱼陪着你，慢慢来" : "离开屏幕，看看远处";
  else if (complete) statusText = session.kind === "focus" ? "专注完成 · 海底长大了" : "休息结束 · 欢迎回来";

  let primaryLabel = selectedKind === "focus" ? "开始专注" : "开始休息";
  let primaryIcon = "play";
  if (active) { primaryLabel = session.status === "running" ? "暂停一下" : "继续这一轮"; primaryIcon = session.status === "running" ? "pause" : "play"; }
  else if (complete && session.kind === "focus") { primaryLabel = "开始休息"; primaryIcon = "coffee"; }
  else if (complete && session.kind === "break") { primaryLabel = "开始下一轮"; }

  const growth = s.completed;
  const growthLabel = `${growth < 3 ? "初生" : growth < 12 ? "萌芽" : growth < 24 ? "繁盛" : "小小绿洲"} · ${growth} 轮专注`;
  const nextGrowth = growth === 0 ? "完成一轮，长出第一株水草" : growth >= 24 ? "继续积累专注，认识更多海底朋友" : growth % 3 === 0 ? "再一轮，海底会长出新植物" : "再一轮，水草会长高一些";

  let caption = "一条鱼，一片海，等你慢慢来。";
  if (s.lastVisitor && complete && session.kind === "focus") caption = `${s.lastVisitor}来做客了，已留在图鉴里。`;
  else if (active && session.kind === "focus") caption = "你专注做事，海底安静陪着你。";
  else if (active && session.kind === "break") caption = "鱼儿不着急，你也可以休息一下。";

  return {
    time,
    ringOffset: 559.2 * Math.min(1, elapsed / duration),
    ringPaused: session.status === "paused",
    statusText,
    primaryLabel,
    primaryIcon,
    taskDisabled: active || selectedKind === "break",
    taskPlaceholder: selectedKind === "break" ? "去喝杯水，让眼睛也休息一下" : "比如读几页书，写一小段代码",
    endHidden: !active,
    footnote: active ? "中断也会记录时间，已有成长不会消失。" : "不着急，每一点专注都会留下痕迹。",
    feedDisabled: session.kind !== "break" || session.status !== "running" || s.fedSession === session.id,
    feedLabel: s.fedSession === s.session.id && s.session.kind === "break" ? "鱼儿吃饱啦" : "撒一点鱼食",
    growthLabel,
    nextGrowth,
    caption,
  };
}

export interface AquariumApi {
  snapshot: Snapshot | null;
  busy: boolean;
  selectedKind: SessionKind;
  healthy: boolean;
  soundPlaying: boolean;
  soundStatus: string;
  themes: ThemeInfo[];
  setSelectedKind: (k: SessionKind) => void;
  timer: TimerDerived | null;
  primary: () => void;
  endSession: () => void;
  feed: () => void;
  pickSound: (kind: string) => void;
  setVolume: (v: number) => void;
  toggleSound: () => void;
  setTheme: (id: string) => void;
  setThemeAuto: (enabled: boolean) => void;
  setThemeShuffle: (enabled: boolean) => void;
  saveSettings: (focusMinutes: number, breakMinutes: number, chimeEnabled: number, onDone: () => void) => void;
  exportArchive: () => void;
  importArchive: () => void;
  importFile: (text: string) => void;
  checkUpdate: () => void;
  setCompact: (v: boolean) => void;
  openSettings: () => void;
  hide: () => void;
  quit: () => void;
  toast: (msg: string) => void;
  toastMessage: string;
  soundRef: React.MutableRefObject<Soundscape | null>;
  reefRef: React.MutableRefObject<import("../reef/Reef").Reef | null>;
  notifyThemeChanged: () => void;
}

export function useAquarium(): AquariumApi {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [healthy, setHealthy] = useState(false);
  const [selectedKind, setSelectedKindState] = useState<SessionKind>("focus");
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [soundStatus, setSoundStatus] = useState("选一段声音，安静陪着你");
  const [themes, setThemes] = useState<ThemeInfo[]>([]);

  const stateRef = useRef<Snapshot | null>(null);
  const previousRef = useRef<Snapshot | null>(null);
  const busyRef = useRef(false);
  const selectedKindRef = useRef<SessionKind>("focus");
  const healthyRef = useRef(false);
  const soundPlayingRef = useRef(false);
  const soundSessionRef = useRef(-1);
  const lastAudioKeyRef = useRef("");
  const adjustingVolumeRef = useRef(false);
  const soundRef = useRef<Soundscape | null>(null);
  const reefRef = useRef<import("../reef/Reef").Reef | null>(null);
  const layoutGeneration = useRef(0);
  const spaceShortcutEnabled = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [, forceToast] = useState(0);
  const toastMsg = useRef("");

  if (!soundRef.current && typeof window !== "undefined") {
    soundRef.current = new Soundscape((message: string, error?: boolean) => {
      setSoundStatus(message);
      if (error) toast(message);
    });
  }

  function toast(message: string): void {
    toastMsg.current = message;
    forceToast((n) => n + 1);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      toastMsg.current = "";
      forceToast((n) => n + 1);
    }, 5500);
  }

  // Applies the live audio key exactly as the original push loop did.
  function updateAudio(next: Snapshot): void {
    const p = next.preferences;
    const playing = soundPlayingRef.current && p.soundEnabled && healthyRef.current;
    const key = `${playing}:${p.sound}:${p.volume}`;
    if (key !== lastAudioKeyRef.current) {
      lastAudioKeyRef.current = key;
      void soundRef.current?.set(playing, p.sound, p.volume);
      reportAudio("");
    }
  }

  function applySoundChoice(before: Snapshot, next: Snapshot, wanted: boolean): Snapshot {
    apply(next);
    const latest = stateRef.current!;
    // A native timer action can supersede the session while preferences are in flight.
    if (latest.session.id === before.session.id && latest.session.status === before.session.status) {
      soundPlayingRef.current = wanted && latest.preferences.soundEnabled && healthyRef.current;
    }
    lastAudioKeyRef.current = "";
    setSoundPlaying(soundPlayingRef.current);
    updateAudio(latest);
    return latest;
  }

  async function settleSound(start: Promise<void>): Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        start,
        new Promise<void>((resolve) => {
          timeout = setTimeout(() => { soundRef.current?.cancel(); resolve(); }, 10000);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }

  function apply(next: Snapshot): void {
    if (stateRef.current && next.revision < stateRef.current.revision) return;
    const previous = stateRef.current;
    stateRef.current = next;
    connected(true);
    const session = next.session;
    if (soundSessionRef.current !== session.id) {
      // Loading an already-running timer must not autoplay on start.
      soundPlayingRef.current = !!previous && session.status === "running" && session.kind === "focus" && next.preferences.soundEnabled;
      soundSessionRef.current = session.id;
    } else if (previous && previous.session.status !== session.status) {
      soundPlayingRef.current = session.status === "running" && session.kind === "focus";
    }
    if (!next.preferences.soundEnabled || session.status === "paused" || session.status === "complete") soundPlayingRef.current = false;
    if (previous && session.id === previous.session.id && session.status === "complete" && previous.session.status !== "complete") {
      if (next.preferences.chimeEnabled) soundRef.current?.chime();
    }
    if (session.status === "running" || session.status === "paused" || session.status === "complete") {
      setSelectedKindState(session.kind as SessionKind);
      selectedKindRef.current = session.kind as SessionKind;
    }
    previousRef.current = previous;
    setSnapshot(next);
    setSoundPlaying(soundPlayingRef.current);
    // Theme rebinding is presentation: the same Snapshot drives it.
    void applyTheme(next.theme || "reef-realistic").then(() => notifyThemeChanged());
    updateAudio(next);
  }

  function connected(h: boolean): void {
    healthyRef.current = h;
    setHealthy(h);
    if (!h) {
      soundPlayingRef.current = false;
      lastAudioKeyRef.current = "";
      setSoundPlaying(false);
      void soundRef.current?.set(false, "waves", 0.35);
    }
  }

  // Mutating RPC wrapper: busy lock, apply result, surface errors as toast.
  async function action<T>(fn: () => Promise<T>): Promise<void> {
    if (busyRef.current || !stateRef.current || !healthyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await fn();
      if (result) apply(result as unknown as Snapshot);
    } catch (error) {
      toast((error as Error).message || "操作未完成，请稍后再试。");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const primary = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    // Unlock audio inside the user's gesture, even when ambience is muted.
    if (state.preferences.chimeEnabled || state.preferences.soundEnabled) void soundRef.current?.unlock().catch(() => {});
    void action(async () => {
      const s = state.session;
      if (s.status === "running") return call("Aquarium.Pause");
      if (s.status === "paused") return call("Aquarium.Resume");
      let kind = selectedKindRef.current;
      if (s.status === "complete" && s.kind === selectedKindRef.current) kind = s.kind === "focus" ? "break" : "focus";
      return call("Aquarium.Start", kind, (document.getElementById("task") as HTMLInputElement | null)?.value ?? "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endSession = useCallback(() => {
    void action(() => call("Aquarium.End"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const feed = useCallback(() => {
    void action(() => call("Aquarium.Feed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSelectedKind = useCallback((k: SessionKind) => {
    selectedKindRef.current = k;
    setSelectedKindState(k);
  }, []);

  const pickSound = useCallback((kind: string) => {
    if (soundPlayingRef.current) void soundRef.current?.unlock().catch(() => {});
    void action(() => call("Aquarium.SetPreferences", { ...(stateRef.current as Snapshot).preferences, sound: kind }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setVolume = useCallback((v: number) => {
    if (soundPlayingRef.current) void soundRef.current?.set(true, (stateRef.current as Snapshot).preferences.sound, v / 100);
    void action(() => call("Aquarium.SetPreferences", { ...(stateRef.current as Snapshot).preferences, volume: v / 100 }));
    adjustingVolumeRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSound = useCallback(() => {
    const state = stateRef.current;
    if (busyRef.current || !state) return;
    const wanted = !soundPlayingRef.current;
    if (wanted) {
      soundRef.current?.unlock().catch((e: Error) => toast(e.message));
    }
    void action(async () => {
      const next = await call<Snapshot>("Aquarium.SetPreferences", { ...state.preferences, soundEnabled: wanted });
      // Preview while idle or on break is an explicit choice.
      applySoundChoice(state, next, wanted);
      reportAudio("");
      return null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Report observed runtime audio state to the native mini panel. actual playing
  // = context running AND requested AND a source has started; not prefs.
  const reportAudio = useCallback((requestId: string) => {
    if (!desktop) return;
    const a = soundRef.current?.audioState();
    const prefs = stateRef.current?.preferences;
    if (!a || !prefs) return;
    const actual = a.contextRunning && a.requested && a.started;
    const needGesture = !a.contextRunning && a.requested;
    void call("Desktop.ReportAudioState", requestId, {
      running: actual, requested: a.requested, sound: a.sound, volume: a.volume,
      needGesture, error: needGesture ? "请打开页面并点一次声音" : a.error,
    }).catch(() => {});
  }, []);

  // Push observed state on every settle / context transition / error.
  useEffect(() => {
    soundRef.current?.setOnChanged(() => reportAudio(""));
    return () => soundRef.current?.setOnChanged(null);
  }, [reportAudio]);

  // Native audio command bridge via the runtime event bus (not DOM events).
  useEffect(() => {
    if (!desktop) return;
    const off = onAudioRequest(async (req) => {
      const state = stateRef.current;
      const noOp = (error: string) => void call("Desktop.ReportAudioState", req.requestId, {
        running: false, requested: false, sound: state?.preferences.sound ?? "waves", volume: state?.preferences.volume ?? 0.35,
        needGesture: false, error,
      }).catch(() => {});
      if (!state) return;
      if (busyRef.current) { noOp("busy"); return; }
      if (req.command !== "toggle" && req.command !== "enable" && req.command !== "disable" && req.command !== "set-volume") { noOp("unknown command"); return; }
      busyRef.current = true; setBusy(true);
      try {
        if (req.command === "set-volume") {
          const v = typeof req.volume === "number" ? Math.min(1, Math.max(0, req.volume)) : state.preferences.volume;
          const next = await call<Snapshot>("Aquarium.SetPreferences", { ...state.preferences, volume: v });
          apply(next);
          const latest = stateRef.current!;
          lastAudioKeyRef.current = ""; updateAudio(latest);
          if (soundPlayingRef.current) {
            await settleSound(soundRef.current!.set(true, latest.preferences.sound, latest.preferences.volume));
          }
        } else {
          const wanted = req.command === "enable" ? true : req.command === "disable" ? false : !soundPlayingRef.current;
          const next = await call<Snapshot>("Aquarium.SetPreferences", { ...state.preferences, soundEnabled: wanted });
          const latest = applySoundChoice(state, next, wanted);
          if (soundPlayingRef.current) {
            await settleSound(soundRef.current!.set(true, latest.preferences.sound, latest.preferences.volume));
          }
        }
      } catch (e) {
        noOp((e as Error).message);
      } finally {
        busyRef.current = false; setBusy(false);
        // Report the observed terminal state; a timeout leaves context not
        // running and requested → needGesture, never a fake "on".
        reportAudio(req.requestId);
      }
    });
    return off;
  }, [reportAudio]);

  function applyCompactLayout(compact: boolean): void {
    layoutGeneration.current++;
    document.body.classList.toggle("compact", compact);
    reefRef.current?.resize();
  }

  // Subscribe before reading so a delayed initial reply cannot overwrite a new mode.
  useEffect(() => {
    if (!desktop) return;
    let stopped = false;
    const generation = layoutGeneration.current;
    const off = onUiRequest((req) => {
      if (stopped) return;
      const ack = (ok: boolean, error = "") => void call("Desktop.AckUIRequest", req.requestId, ok, error).catch(() => {});
      if (req.command === "set-compact") {
        // Go already applied the window geometry; the page only syncs its own
        // layout class and ACKs (no duplicate SetCompact round-trip).
        applyCompactLayout(req.compact ?? false);
        ack(true);
      }
    });
    void call<boolean>("Desktop.GetCompact").then((compact) => {
      if (!stopped && generation === layoutGeneration.current && typeof compact === "boolean") applyCompactLayout(compact);
    }).catch((error: Error) => { if (!stopped) toast(error.message); });
    return () => { stopped = true; off(); };
  }, []);

  const openSettings = useCallback(() => {
    if (desktop) void call("Desktop.OpenSettings").catch((error: Error) => toast(error.message));
  }, []);

  const setTheme = useCallback((id: string) => {
    void action(() => call("Aquarium.SetTheme", id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setThemeAuto = useCallback((enabled: boolean) => {
    void action(() => call("Aquarium.SetThemeAuto", enabled));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setThemeShuffle = useCallback((enabled: boolean) => {
    void action(() => call("Aquarium.SetThemeShuffle", enabled));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = useCallback((focusMinutes: number, breakMinutes: number, chimeEnabled: number, onDone: () => void) => {
    const state = stateRef.current;
    if (!state) return;
    void action(async () => {
      const next = await call<Snapshot>("Aquarium.SetPreferences", {
        ...state.preferences, focusMinutes, breakMinutes, chimeEnabled: !!chimeEnabled,
      } as Preferences);
      onDone();
      toast("设置已保存，时长从下一轮生效。");
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportArchive = useCallback(() => {
    (async () => {
      try {
        if (desktop) {
          const path = await call<string>("Desktop.ExportArchive");
          if (path) toast(exportToast((path as string).split("/").pop() as string));
        } else {
          const text = await call<string>("Aquarium.ExportArchive");
          downloadArchive("little-reef-archive.json", text as unknown as string);
          toast(exportToast("little-reef-archive.json"));
        }
      } catch (error) {
        toast((error as Error).message || "导出未完成，请稍后再试。");
      }
    })();
  }, []);

  const importArchive = useCallback(() => {
    if (!desktop) return;
    if (!window.confirm(importConfirm)) return;
    void action(async () => {
      const snap = await call<Snapshot>("Desktop.ImportArchive");
      apply(snap);
      toast(snap.notice || importSuccess);
      return null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importFile = useCallback((text: string) => {
    if (!window.confirm(importConfirm)) return;
    void action(async () => {
      const snap = await call<Snapshot>("Aquarium.ImportArchive", text);
      apply(snap);
      toast(snap.notice || importSuccess);
      return null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkUpdate = useCallback(() => {
    if (desktop) void call("Desktop.CheckForUpdates").catch(() => {});
  }, []);

  const setCompact = useCallback((v: boolean) => {
    const generation = ++layoutGeneration.current;
    (async () => {
      try {
        if (desktop) await call("Desktop.SetCompact", v);
        if (generation === layoutGeneration.current) applyCompactLayout(v);
      } catch (error) {
        toast((error as Error).message);
        if (desktop && generation === layoutGeneration.current) {
          try {
            const compact = await call<boolean>("Desktop.GetCompact");
            if (generation === layoutGeneration.current && typeof compact === "boolean") applyCompactLayout(compact);
          } catch { /* Preserve the error from the original operation. */ }
        }
      }
    })();
  }, []);

  const hide = useCallback(() => {
    void call("Desktop.Hide").catch((error: Error) => toast(error.message));
  }, []);

  const quit = useCallback(() => {
    void call("Desktop.Quit").catch((error: Error) => toast(error.message));
  }, []);

  function notifyThemeChanged(): void {
    // The settings picker re-syncs its active radio from the current snapshot.
    setThemes((list) => [...list]);
  }

  // Load the theme list once (backend-sourced, never hardcoded).
  useEffect(() => {
    let cancelled = false;
    call<ThemeInfo[]>("Aquarium.GetThemes")
      .then((list) => { if (!cancelled) setThemes(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Subscribe before the initial read (race-free), exactly as bridge does.
  useEffect(() => {
    let stopped = false;
    let stopSub = () => {};
    subscribe({
      apply: (next) => { if (!stopped) apply(next); },
      connected: (h) => { if (!stopped) connected(h); },
      error: (error) => { if (!stopped) toast(error.message); },
    }).then((stop) => {
      if (stopped) stop();
      else stopSub = stop;
    });
    return () => { stopped = true; stopSub(); soundRef.current?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!desktop) return;
    let stopped = false;
    let receivedUpdate = false;
    const accept = (settings: ShortcutSnapshot) => {
      if (!stopped && typeof settings.spaceEnabled === "boolean") spaceShortcutEnabled.current = settings.spaceEnabled;
    };
    const off = onShortcutSettings((settings) => { receivedUpdate = true; accept(settings); });
    void call<ShortcutSnapshot>("Desktop.GetShortcutSettings").then((settings) => {
      if (!receivedUpdate) accept(settings);
    }).catch(() => {});
    return () => { stopped = true; off(); };
  }, []);

  // Spacebar starts/pauses unless focus is in an interactive control or a modal
  // (Radix renders role=dialog, not a native <dialog>, so match by role/state).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!spaceShortcutEnabled.current || event.code !== "Space" || event.repeat || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (!target || target.closest("input, textarea, button, select, summary, [contenteditable='true'], [role='slider'], [role='checkbox'], [role='radio'], [role='switch'], [role='textbox']")) return;
      if (document.querySelector("[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open'], [role='menu'][data-state='open']")) return;
      event.preventDefault();
      primary();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [primary]);

  // Keep the reef canvas in sync with every snapshot.
  useEffect(() => {
    if (snapshot && reefRef.current) reefRef.current.update(snapshot);
  }, [snapshot]);

  // Update the document title with the running timer.
  useEffect(() => {
    const t = snapshot ? deriveTimer(snapshot, selectedKind) : null;
    const active = !!snapshot && (snapshot.session.status === "running" || snapshot.session.status === "paused");
    document.title = active && t ? `${t.time} · 小海底` : "小海底 · 桌面水族馆";
  }, [snapshot, selectedKind]);

  const timer = snapshot ? deriveTimer(snapshot, selectedKind) : null;

  return {
    snapshot, busy, selectedKind, healthy, soundPlaying, soundStatus, themes,
    setSelectedKind, timer, primary, endSession, feed, pickSound, setVolume, toggleSound,
    setTheme, setThemeAuto, setThemeShuffle, saveSettings, exportArchive, importArchive, importFile, checkUpdate,
    setCompact, hide, quit, toast, toastMessage: toastMsg.current, soundRef, reefRef, notifyThemeChanged,
    openSettings,
  };
}
