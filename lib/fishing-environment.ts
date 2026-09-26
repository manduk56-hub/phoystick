import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export function lakeBackdrop(texture: T.Texture) {
  texture.colorSpace = T.SRGBColorSpace;
  // Only the landscape above the shoreline belongs on the backdrop.
  // The lower photographic water is replaced by the reflective lake.
  texture.repeat.set(-1, 0.49);
  texture.offset.set(1, 0.51);
  const backdrop = new T.Mesh(
    new T.CylinderGeometry(
      150,
      150,
      78,
      96,
      1,
      true,
      Math.PI * 0.75,
      Math.PI * 0.5,
    ),
    new T.MeshBasicMaterial({ map: texture, side: T.BackSide, fog: false }),
  );
  backdrop.position.y = 37;
  return backdrop;
}

export function reflectiveLake() {
  const water = new Reflector(new T.PlaneGeometry(500, 500), {
    textureWidth: 768,
    textureHeight: 768,
    multisample: 0,
    clipBias: 0.003,
    color: 0x235961,
    shader: {
      name: 'FishingLake',
      uniforms: {
        color: { value: new T.Color(0x235961) },
        tDiffuse: { value: null },
        textureMatrix: { value: new T.Matrix4() },
        time: { value: 0 },
        wind: { value: 1.8 },
      },
      vertexShader: `
        uniform mat4 textureMatrix;
        varying vec4 reflectionUv;
        varying vec3 worldPoint;
        void main() {
          reflectionUv = textureMatrix * vec4(position, 1.0);
          worldPoint = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float wind;
        varying vec4 reflectionUv;
        varying vec3 worldPoint;
        void main() {
          vec2 p = worldPoint.xz;
          vec2 wave = vec2(
            sin(p.x * 1.6 + p.y * 0.7 + time * 0.9) + sin(p.y * 3.4 - time * 1.1) * 0.35,
            cos(p.y * 2.1 + p.x * 0.4 - time * 0.75) + cos(p.x * 4.2 + time) * 0.3
          );
          vec3 view = normalize(cameraPosition - worldPoint);
          float fresnel = 0.18 + 0.72 * pow(1.0 - abs(view.y), 3.0);
          vec2 uv = reflectionUv.xy / reflectionUv.w;
          uv += wave * (0.0008 + wind * 0.00035);
          vec3 reflected = texture2D(tDiffuse, uv).rgb;
          vec3 lake = mix(color * (0.85 + wave.x * 0.035), reflected, fresnel);
          gl_FragColor = vec4(lake, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    },
  });
  water.rotation.x = -Math.PI / 2;
  return water;
}
