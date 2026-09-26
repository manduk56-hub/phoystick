import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('phone landscape restores the menu and cleans up a late lock', async () => {
  const previous = Object.getOwnPropertyDescriptors(globalThis);
  let cleanup;
  let locks = 0;
  let unlocks = 0;
  let resolveLock;
  let delay = false;
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.hidden = false;
  doc.fullscreenElement = null;
  doc.documentElement = {
    requestFullscreen: async () => { doc.fullscreenElement = doc.documentElement; },
  };
  let exits = 0;
  doc.exitFullscreen = async () => { exits++; doc.fullscreenElement = null; };
  const orientation = {
    lock: async () => {
      locks++;
      if (!doc.fullscreenElement) throw new Error('Fullscreen required');
      if (delay) await new Promise(resolve => { resolveLock = resolve; });
    },
    unlock: () => { unlocks++; },
  };
  const globals = {
    window: win, document: doc, screen: { orientation },
    __landscapeEffect: (effect) => { cleanup = effect(); },
  };
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  try {
    const source = readFileSync(new URL('../lib/use-phone-landscape.ts', import.meta.url), 'utf8')
      .replace("import { useEffect } from 'react';", 'const useEffect = globalThis.__landscapeEffect;');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    const { usePhoneLandscape } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
    const settle = () => new Promise(resolve => setImmediate(resolve));
    usePhoneLandscape(true);
    await settle();
    assert.equal(locks, 2);
    assert.equal(doc.fullscreenElement, doc.documentElement);
    win.dispatchEvent(new Event('game-menu-open'));
    assert.equal(unlocks, 1);
    assert.equal(exits, 1);
    assert.equal(doc.fullscreenElement, null);
    delay = true;
    win.dispatchEvent(new Event('game-menu-close'));
    await settle();
    assert.equal(locks, 4);
    cleanup();
    resolveLock();
    await settle();
    assert.equal(unlocks, 2);
    assert.equal(doc.fullscreenElement, null);
    win.dispatchEvent(new Event('game-menu-close'));
    await settle();
    assert.equal(locks, 4);
  } finally {
    cleanup?.();
    for (const key of Object.keys(globals)) {
      if (previous[key]) Object.defineProperty(globalThis, key, previous[key]);
      else delete globalThis[key];
    }
  }
});
