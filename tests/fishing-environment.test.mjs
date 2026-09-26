import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { lakeBackdrop } from '../lib/fishing-environment.ts';

test('sky or lake covers the cast camera at every stage, distance, spot and aspect ratio', () => {
  const texture = new T.Texture();
  const dome = lakeBackdrop(texture);
  dome.updateMatrixWorld(true);
  const camera = new T.PerspectiveCamera(54, 1, 0.1, 600);
  camera.position.set(0, 3.4, 8);
  const ray = new T.Raycaster();
  const plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const hit = new T.Vector3();
  for (const aspect of [0.5, 1.5, 2.4]) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    for (const distance of [11.6, 23.6, 76]) {
      for (const x of [-4, 0, 4]) {
        for (let step = 0; step <= 12; step++) {
          const progress = step / 12;
          camera.lookAt(
            x,
            Math.sin(progress * Math.PI) * 5 + 0.15,
            3 - distance * progress,
          );
          camera.updateMatrixWorld(true);
          for (const ndc of [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
            [0, 1],
            [0, 0],
          ]) {
            ray.setFromCamera(new T.Vector2(...ndc), camera);
            const lakeHit = ray.ray.intersectPlane(plane, hit);
            const lakeCovers =
              lakeHit && Math.abs(hit.x) <= 250 && Math.abs(hit.z) <= 250;
            assert.ok(
              lakeCovers || ray.intersectObject(dome).length > 0,
              `uncovered cast: aspect ${aspect}, distance ${distance}, spot ${x}, progress ${progress}, corner ${ndc}`,
            );
          }
        }
      }
    }
  }
  dome.geometry.dispose();
  dome.material.dispose();
  texture.dispose();
});
