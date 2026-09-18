import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../lib/game.ts';
function game() {
  const g = Object.create(Game.prototype);
  g.hud = {
    health: 100,
    ammo: 11,
    chamber: true,
    reload: 0,
    score: 0,
    kills: 0,
    wave: 1,
    state: 'playing',
    hit: '',
  };
  g.aim = { x: 0.5, y: 0.5 };
  g.camera = { add() {} };
  g.casings = [];
  g.emit = () => {};
  g.sound = () => {};
  g.lastShot = -Infinity;
  g.scene = { updateMatrixWorld() {} };
  g.ray = {
    setFromCamera() {},
    intersectObjects() {
      return [];
    },
  };
  g.enemies = [];
  g.onShot = () => {};
  return g;
}
test('12 shots empty chamber; dry fire cannot consume negative ammunition', () => {
  const g = game();
  for (let i = 0; i < 12; i++) {
    g.lastShot = -Infinity;
    g.fire(0.5, 0.5);
  }
  assert.equal(g.hud.ammo, 0);
  assert.equal(g.hud.chamber, false);
  g.lastShot = -Infinity;
  g.fire(0.5, 0.5);
  assert.equal(g.hud.ammo, 0);
});
test('empty reload needs all three operations and racks one cartridge', () => {
  const g = game();
  g.hud.ammo = 0;
  g.hud.chamber = false;
  g.reload();
  assert.equal(g.hud.reload, 0);
  assert.equal(g.hud.reloadMotion, 1);
  g.advanceReload(1);
  assert.equal(g.hud.reload, 1);
  g.reload();
  assert.equal(g.hud.ammo, 0);
  g.advanceReload(1.1);
  assert.equal(g.hud.ammo, 12);
  assert.equal(g.hud.chamber, false);
  g.reload();
  g.advanceReload(1);
  assert.equal(g.hud.reload, 0);
  assert.equal(g.hud.ammo, 11);
  assert.equal(g.hud.chamber, true);
});
test('loaded chamber is preserved during tactical reload and firing blocked during reload', () => {
  const g = game();
  g.reload();
  g.fire(0.5, 0.5);
  assert.equal(g.hud.ammo, 11);
  g.advanceReload(1);
  g.reload();
  g.advanceReload(1.1);
  g.reload();
  g.advanceReload(1);
  assert.equal(g.hud.ammo, 12);
  assert.equal(g.hud.chamber, true);
});
test('reload cannot skip a running animation and freezes when paused', () => {
  const g = game();
  g.reload();
  g.advanceReload(0.2);
  const progress = g.hud.reloadProgress;
  g.reload();
  assert.equal(g.hud.reloadMotion, 1);
  assert.equal(g.hud.reloadProgress, progress);
  g.pause();
  g.advanceReload(10);
  assert.equal(g.hud.reloadProgress, progress);
  g.pause();
  g.advanceReload(1);
  assert.equal(g.hud.reload, 1);
  assert.equal(g.hud.reloadMotion, 0);
});
test('clamps pointer to screen bounds', () => {
  const g = game();
  g.setAim(-0.2, 1.4);
  assert.deepEqual(g.aim, { x: 0, y: 1 });
});
test('head hit kills and adds score once', () => {
  const g = game();
  const head = {};
  const e = { head, parts: [head], hp: 2 };
  g.enemies = [e];
  g.remove = () => {};
  g.ray.intersectObjects = () => [{ object: head }];
  g.fire(0.5, 0.5);
  assert.equal(g.hud.score, 150);
  assert.equal(g.hud.kills, 1);
  assert.equal(g.enemies.length, 0);
});
test('paused state ignores fire and reload; pause resumes', () => {
  const g = game();
  g.pause();
  g.action('fire');
  g.action('reload');
  assert.equal(g.hud.ammo, 11);
  assert.equal(g.hud.reload, 0);
  g.pause();
  assert.equal(g.hud.state, 'playing');
});
