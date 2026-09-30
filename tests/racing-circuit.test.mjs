import test from 'node:test';
import assert from 'node:assert/strict';

// TextureLoader needs an image element while building the road material.
globalThis.document = {
  createElementNS: () => ({
    addEventListener() {},
    removeEventListener() {},
    set src(_) {},
  }),
};

const { buildCircuit } = await import('../lib/racing-circuit.ts');

test('the permanent circuit batches fixed obstacles without dropping them', () => {
  const circuit = buildCircuit();
  let drawObjects = 0;
  let fixedBoxes = 0;
  let road = 0;
  circuit.traverse((object) => {
    if (object.isMesh) drawObjects++;
    if (object.isInstancedMesh) fixedBoxes += object.count;
    if (object.name === 'circuit-road') road++;
  });
  assert.equal(road, 1);
  assert.ok(fixedBoxes >= 1300, `expected fixed obstacles, got ${fixedBoxes}`);
  assert.ok(drawObjects < 50, `expected batched draw objects, got ${drawObjects}`);
});
