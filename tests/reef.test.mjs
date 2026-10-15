import test from 'node:test';
import assert from 'node:assert/strict';
import { Reef } from '../web/reef.js';

test('native and browser motion preferences stop and resume the actual animation scheduler', () => {
  let nextFrame = 0, frames = new Map(), nativeChange, mediaChange, visibilityChange;
  const media = { matches: false, addEventListener(_event, fn) { mediaChange = fn; } };
  const replacements = {
    mygo: { preferences: { reduceMotion: true }, on(_event, fn) { nativeChange = fn; } },
    matchMedia: () => media,
    ResizeObserver: class { observe() {} },
    document: { hidden: false, addEventListener(_event, fn) { visibilityChange = fn; } },
    devicePixelRatio: 1,
    requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
  };
  const previous = Object.fromEntries(Object.keys(replacements).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, replacements);
  const draw = Reef.prototype.draw;
  let draws = 0;
  Reef.prototype.draw = () => { draws++; };
  try {
    const reef = new Reef({ getContext: () => ({ setTransform() {} }), getBoundingClientRect: () => ({ width: 400, height: 350 }) });
    assert.equal(frames.size, 0, 'native preference applies at first paint');
    reef.update({ fedSession: 'before' });
    reef.update({ fedSession: 'after' });
    assert.equal(reef.foodUntil, 0, 'reduced motion does not leave feeding frozen indefinitely');
    assert.ok(draws > 0, 'static aquarium still renders');
    nativeChange({ reduceMotion: false });
    assert.equal(frames.size, 1);
    reef.update({ fedSession: 'next' });
    assert.ok(reef.foodUntil > 0);
    media.matches = true; mediaChange();
    assert.equal(frames.size, 0);
    assert.equal(reef.foodUntil, 0);
    nativeChange({ reduceMotion: false });
    assert.equal(frames.size, 0, 'browser preference still takes precedence');
    media.matches = false; mediaChange();
    assert.equal(frames.size, 1);
    document.hidden = true; visibilityChange();
    assert.equal(frames.size, 0);
    document.hidden = false; visibilityChange();
    assert.equal(frames.size, 1, 'exactly one loop resumes');
    nativeChange({ reduceMotion: true });
    assert.equal(frames.size, 0);
  } finally {
    Reef.prototype.draw = draw;
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
