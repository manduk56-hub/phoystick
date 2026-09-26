import test from 'node:test';
import assert from 'node:assert/strict';
import { RodSpring, createFish } from '../lib/fishing-detail.ts';
import * as T from 'three';

test('rod spring settles, restores after unloading, and freezes at zero dt', () => {
  const spring = new RodSpring();
  for (let i = 0; i < 240; i++) spring.update(0.8, 1 / 60, 0);
  assert.ok(Math.abs(spring.bend - 0.8) < 0.001);
  const frozen = spring.bend;
  spring.update(0, 0, 0);
  assert.equal(spring.bend, frozen);
  for (let i = 0; i < 240; i++) spring.update(0, 0.05, 2);
  assert.ok(Math.abs(spring.bend) < 0.001);
});

test('rod response is consistent across frame rates', () => {
  const a = new RodSpring(),
    b = new RodSpring();
  for (let i = 0; i < 60; i++) a.update(1, 1 / 60, 1);
  for (let i = 0; i < 20; i++) b.update(1, 0.05, 1);
  assert.ok(Math.abs(a.bend - b.bend) < 0.01);
});

test('six species have distinct body shapes and valid fin topology', () => {
  const heights = [];
  for (let id = 0; id < 6; id++) {
    const fish = createFish(id);
    const body = fish.children[0];
    body.geometry.computeBoundingBox();
    heights.push(body.geometry.boundingBox.max.y);
    fish.traverse((object) => {
      if (object instanceof T.Mesh || object instanceof T.Line) {
        const positions = object.geometry.attributes.position;
        assert.ok(Array.from(positions.array).every(Number.isFinite));
        const index = object.geometry.index;
        if (index)
          assert.ok(Array.from(index.array).every((i) => i < positions.count));
        object.geometry.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }
  assert.equal(new Set(heights).size, 6);
});
