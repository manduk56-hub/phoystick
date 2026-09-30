import { sentinel } from './object-design.ts';
import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

let decoder: DRACOLoader | undefined;
function draco() {
  return (decoder ??= new DRACOLoader().setDecoderPath('/assets/draco/'));
}
const models = new Map<string, Promise<GLTF>>();
const sharedModelGeometry = new WeakSet<T.BufferGeometry>();
export function gameModel(name: 'yeti' | 'car') {
  if (name !== 'car')
    return Promise.resolve({
      scene: sentinel(),
      animations: [] as T.AnimationClip[],
    });
  if (!models.has(name))
    models.set(
      name,
      new GLTFLoader()
        .setDRACOLoader(draco())
        .loadAsync(`/assets/models/${name}.glb`)
        .catch((e) => {
          console.error('3D asset load failed', name, e);
          models.delete(name);
          throw e;
        }),
    );
  return models.get(name)!.then((source) => {
    const scene = clone(source.scene) as T.Group;
    scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        // Car instances share the immutable GLTF geometry; only paint and
        // lighting materials need a per-car copy.
        sharedModelGeometry.add(o.geometry);
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return { scene, animations: source.animations };
  });
}
export function disposeModel(root: T.Object3D) {
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      if (!sharedModelGeometry.has(o.geometry)) o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        m.dispose(),
      );
      if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
    }
  });
}
export function fitModel(
  root: T.Object3D,
  size: number,
  axis: 'x' | 'y' | 'z' = 'y',
) {
  root.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(root),
    dimensions = box.getSize(new T.Vector3()),
    center = box.getCenter(new T.Vector3());
  const scale = size / Math.max(0.0001, dimensions[axis]);
  const wrapper = new T.Group();
  wrapper.add(root);
  root.position.sub(center);
  root.position.y += dimensions.y / 2;
  wrapper.scale.setScalar(scale);
  return wrapper;
}
export function scannedMaterial(
  name: 'rock_boulder_dry' | 'asphalt_02' | 'concrete_floor_02',
  repeat = 1,
) {
  const loader = new T.TextureLoader();
  const read = (type: string, color = false) => {
    const t = loader.load(`/assets/pbr/${name}_${type}.jpg`);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 8;
    if (color) t.colorSpace = T.SRGBColorSpace;
    return t;
  };
  return new T.MeshStandardMaterial({
    map: read('Diffuse', true),
    normalMap: read('nor_gl'),
    roughnessMap: read('Rough'),
    normalScale: new T.Vector2(0.65, 0.65),
    roughness: 1,
  });
}
export function cinematicLight(
  renderer: T.WebGLRenderer,
  scene: T.Scene,
  exposure = 1,
  sky = false,
) {
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  let skyTexture: T.Texture | undefined;
  let ended = false,
    environment: T.WebGLRenderTarget | undefined;
  new HDRLoader().load(
    '/assets/pbr/daylight.hdr',
    (texture) => {
      if (ended) {
        texture.dispose();
        return;
      }
      const generator = new T.PMREMGenerator(renderer);
      environment = generator.fromEquirectangular(texture);
      scene.environment = environment.texture;
      scene.environmentIntensity = 0.55;
      if (sky) {
        texture.mapping = T.EquirectangularReflectionMapping;
        scene.background = texture;
        skyTexture = texture;
      } else texture.dispose();
      generator.dispose();
    },
    undefined,
    () => {},
  );
  return () => {
    ended = true;
    environment?.dispose();
    skyTexture?.dispose();
  };
}
export function assetNotice(canvas: HTMLCanvasElement, label: string) {
  const notice = document.createElement('div');
  notice.className = 'asset-notice';
  notice.setAttribute('role', 'status');
  notice.textContent = label + ' 불러오는 중…';
  canvas.parentElement?.appendChild(notice);
  return {
    done: () => notice.remove(),
    fail: () => {
      notice.textContent =
        label +
        ' 다운로드 실패 · 기본 모델로 플레이 중입니다. 새로고침해 다시 시도하세요.';
      notice.classList.add('asset-notice-error');
    },
    dispose: () => notice.remove(),
  };
}
