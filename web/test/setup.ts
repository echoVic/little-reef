import "@testing-library/jest-dom/vitest";

// Radix primitives observe elements; jsdom ships no ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as Record<string, unknown>).ResizeObserver =
  (globalThis as Record<string, unknown>).ResizeObserver ?? ResizeObserverStub;

// jsdom lacks pointer capture; Radix Slider touches it on pointer events.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const G = globalThis as any;
if (G.Element?.prototype) {
  const proto = G.Element.prototype;
  proto.hasPointerCapture = proto.hasPointerCapture ?? (() => false);
  proto.setPointerCapture = proto.setPointerCapture ?? (() => {});
  proto.releasePointerCapture = proto.releasePointerCapture ?? (() => {});
}
G.window = G.window ?? {};
if (!G.window.matchMedia) {
  G.window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} });
}
