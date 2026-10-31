// Type shim for the integrity-pinned vendored mygo-runtime (web/vendor/mygo-runtime/index.js).
// The runtime itself is plain JS shipped offline; this declaration lets TS type
// the surface the app uses without pulling the package from npm at build time.
export function isMyGo(): boolean;
export function call(method: string, ...args: unknown[]): Promise<unknown>;
export function on(name: string, listener: (payload: never) => void): () => void;
export function onPreferences(listener: (p: { reduceMotion?: boolean }) => void): void;
export {};
