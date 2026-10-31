// src/index.ts
function isMyGo() {
  return typeof globalThis === "object" && globalThis.mygo !== undefined;
}
function runtime() {
  const rt = globalThis.mygo;
  if (!rt)
    throw new Error("mygo: runtime not found; is this page running inside a MyGo window?");
  return rt;
}
function call(method, ...args) {
  try {
    return runtime().call(method, ...args);
  } catch (err) {
    return Promise.reject(err);
  }
}
var Channel = function(onmessage) {
  return runtime().channel(onmessage);
};
function on(name, listener) {
  return runtime().on(name, listener);
}
function once(name, listener) {
  return runtime().once(name, listener);
}
function locale() {
  return runtime().locale;
}
function direction() {
  return runtime().dir;
}
function onLocaleChange(listener) {
  return on("mygo:locale", (p) => listener(p.locale, p.dir));
}
function event(name) {
  return {
    name,
    on: (listener) => on(name, listener),
    once: (listener) => once(name, listener)
  };
}
function isCallError(err) {
  return err instanceof Error && err.name === "CallError";
}
function onFileDrop(listener) {
  return on("mygo:file-drop", listener);
}
function onDocumentState(listener) {
  return on("mygo:document-state", listener);
}
function onDocumentReload(listener) {
  return on("mygo:document-reload", () => listener());
}
function preferences() {
  return runtime().preferences;
}
function onPreferences(listener) {
  return on("mygo:preferences", listener);
}
var currentWindow = {
  minimize: async () => runtime().window.minimize(),
  maximize: async () => runtime().window.maximize(),
  unmaximize: async () => runtime().window.unmaximize(),
  toggleMaximize: async () => runtime().window.toggleMaximize(),
  isMaximized: async () => runtime().window.isMaximized(),
  toggleFullScreen: async () => runtime().window.toggleFullScreen(),
  close: async () => runtime().window.close(),
  setTitle: async (title) => runtime().window.setTitle(title)
};
export {
  Channel,
  call,
  currentWindow,
  direction,
  event,
  isCallError,
  isMyGo,
  locale,
  on,
  onDocumentReload,
  onDocumentState,
  onFileDrop,
  onLocaleChange,
  onPreferences,
  once,
  preferences,
  runtime
};
