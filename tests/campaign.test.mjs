import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { Game } from '../lib/game.ts';
import { canStand, sectorAt, BARRIERS } from '../lib/campaign.ts';
function campaign() {
  const g = Object.create(Game.prototype);
  Object.assign(g, { hud: {state:'playing', health:50, score:0}, camera:{position:new Vector3(0,1.7,7)}, keys:new Set(), checkpoints:new Set(), enemies:[], extraction:0, emit(){} });
  return g;
}
test('walking advances actual camera; pause freezes movement and extraction', () => {
  const g = campaign();
  g.keys.add('KeyW');
  g.advanceCampaign(1);
  assert.ok(g.camera.position.z < 7);
  const z = g.camera.position.z;
  g.hud.state = 'paused';
  g.advanceCampaign(20);
  assert.equal(g.camera.position.z,z);
});
test('barriers and route edges block movement; diagonal speed is normalized', () => {
  const b = BARRIERS[0];
  assert.equal(canStand(b.x,b.z),false);
  assert.equal(canStand(7,0),false);
  const g=campaign(); g.keys.add('KeyW'); g.keys.add('KeyD'); g.advanceCampaign(1);
  assert.ok(Math.abs(Math.hypot(g.camera.position.x,7-g.camera.position.z)-3.4)<0.0001);
});
test('checkpoints heal once and sectors depend on position, not kills', () => {
  const g=campaign(); g.camera.position.z=-54; g.advanceCampaign(0);
  assert.equal(g.hud.wave,2); assert.equal(g.hud.health,75);
  g.camera.position.z=-50; g.advanceCampaign(0);
  g.camera.position.z=-54; g.advanceCampaign(0);
  assert.equal(g.hud.health,75); assert.equal(sectorAt(240),3);
});
test('extraction requires reaching exit and eight uninterrupted safe seconds', () => {
  const g=campaign(); g.advanceCampaign(20); assert.equal(g.hud.state,'playing');
  g.camera.position.z=-233; g.advanceCampaign(4); assert.equal(g.extraction,4);
  g.enemies=[{group:{position:new Vector3(0,0,-235)}}]; g.advanceCampaign(1);
  assert.equal(g.extraction,0); g.enemies=[];
  g.advanceCampaign(8); assert.equal(g.hud.state,'won'); assert.equal(g.hud.score,1000);
  g.advanceCampaign(8); assert.equal(g.hud.score,1000);
});
test('automatic movement stops at the end of the route', () => {
  const g=campaign(); g.hud.autoMove=true; g.camera.position.z=-232;
  g.advanceCampaign(1); assert.equal(g.camera.position.z,-233);
});
