import {
  call as nativeCall,
  isMyGo,
  on,
} from "mygo-runtime";
import type { Snapshot, ShortcutSnapshot } from "./types";

// MyGo's official runtime owns desktop IPC. Only the optional browser demo
// needs HTTP/SSE; both surfaces share these calls and the same Snapshot.
export const desktop = isMyGo();

export async function call<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
  if (desktop) return nativeCall(method, ...args) as Promise<T>;
  const response = await fetch("/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, args }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "操作暂时失败，请重试。");
  return data as T;
}

export interface Subscriber {
  apply: (next: Snapshot) => void;
  connected: (healthy: boolean) => void;
  error: (error: Error) => void;
}

// Native command channels (Go→web). Routed through the MyGo runtime event bus,
// not DOM events, so Go.Broadcast actually reaches the page.
export interface AudioRequest { requestId: string; command: "toggle" | "enable" | "disable" | "set-volume"; volume?: number }
export interface UiRequest { requestId: string; command: "set-compact"; compact?: boolean }

export function onAudioRequest(cb: (e: AudioRequest) => void): () => void {
  if (!desktop) return () => {};
  return on("desktop:audio-request", cb);
}
export function onUiRequest(cb: (e: UiRequest) => void): () => void {
  if (!desktop) return () => {};
  return on("desktop:ui-request", cb);
}

export function onShortcutSettings(cb: (settings: ShortcutSnapshot) => void): () => void {
  if (!desktop) return () => {};
  return on("desktop:shortcuts-changed", cb);
}

// The creator of the subscription owns its disposer. Listener registration
// precedes the initial read, so a change during startup cannot be missed.
export async function subscribe({ apply, connected, error }: Subscriber): Promise<() => void> {
  let stopped = false;
  const receive = (next: Snapshot) => {
    if (stopped) return;
    try {
      apply(next);
    } catch (err) {
      error(err as Error);
    }
  };
  if (desktop) {
    const off = on("aquarium:changed", receive);
    try {
      receive(await call<Snapshot>("Aquarium.Get"));
    } catch (err) {
      if (!stopped) {
        connected(false);
        error(err as Error);
      }
    }
    return () => {
      stopped = true;
      off();
    };
  }
  const events = new EventSource("/events");
  events.onmessage = (event) => {
    if (stopped) return;
    try {
      receive(JSON.parse((event as MessageEvent).data as string) as Snapshot);
    } catch {
      error(new Error("水族馆状态暂时无法读取。"));
    }
  };
  events.onerror = () => {
    if (!stopped) connected(false);
  };
  // Only a valid Snapshot re-enables controls, not an open-but-empty stream.
  return () => {
    stopped = true;
    events.close();
  };
}
