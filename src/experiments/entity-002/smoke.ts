import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Group, InstancedBufferAttribute, InstancedMesh,
  Matrix4, PlaneGeometry, Points, ShaderMaterial,
} from "three";
import { createRandom } from "../../core/math";

const smokeVertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime, uSpread;
varying vec2 vUv;
varying float vAlpha, vSeed, vLow;
void main() {
  vUv = uv;
  float life = fract(uTime * (0.05 + aSeed.y * 0.05) + aSeed.x);
  vec3 base = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  // Wisps peel off the body, rise and curl, then fade.
  vec3 drift = vec3(sin(uTime * 0.3 + aSeed.z * 6.28) * 0.6, life * 2.6, cos(uTime * 0.25 + aSeed.w * 6.28) * 0.4);
  vec3 centre = base * (1.0 + uSpread * 0.35) + drift;
  float size = (1.4 + aSeed.y * 2.2) * (0.5 + life * 0.9) * (1.0 + uSpread * 0.4);
  vec4 view = modelViewMatrix * vec4(centre, 1.0);
  float a = aSeed.z * 6.28 + uTime * 0.1 * (aSeed.w - 0.5);
  vec2 corner = mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy * size;
  view.xy += corner;
  vAlpha = smoothstep(0.0, 0.2, life) * (1.0 - smoothstep(0.55, 1.0, life));
  vSeed = aSeed.x;
  vLow = smoothstep(1.0, -3.0, centre.y);
  gl_Position = projectionMatrix * view;
}
`;
const smokeFragment = /* glsl */ `
uniform float uTime, uPresence;
varying vec2 vUv;
varying float vAlpha, vSeed, vLow;
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, v = 0.0; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.1; a *= 0.5; } return v; }
void main() {
  vec2 p = vUv - 0.5;
  float d = length(p) * 2.0;
  float n = fbm(vUv * 3.0 + vec2(vSeed * 10.0, uTime * 0.08));
  float shape = smoothstep(1.0, 0.2, d + (n - 0.5) * 0.9) * smoothstep(1.0, 0.75, d);
  float a = shape * vAlpha * 0.45 * uPresence;
  vec3 violet = vec3(0.05, 0.025, 0.07), crimson = vec3(0.12, 0.015, 0.04);
  vec3 color = mix(violet, crimson, vLow * 0.5) * (0.6 + n * 0.5);
  gl_FragColor = vec4(color * a, a);
}
`;
const emberVertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime, uPixelRatio;
varying float vGlow;
void main() {
  float life = fract(uTime * (0.06 + aSeed.y * 0.08) + aSeed.x);
  vec3 p = position + vec3(sin(uTime * 0.7 + aSeed.z * 6.28) * 0.5, life * 9.0, cos(uTime * 0.5 + aSeed.w * 6.28) * 0.5);
  vec4 view = modelViewMatrix * vec4(p, 1.0);
  vGlow = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.6, 1.0, life)) * (0.5 + 0.5 * sin(uTime * 7.0 + aSeed.z * 40.0));
  gl_PointSize = (1.2 + aSeed.y * 2.2) * uPixelRatio * (20.0 / -view.z);
  gl_Position = projectionMatrix * view;
}
`;
const emberFragment = /* glsl */ `
uniform float uPresence;
varying float vGlow;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float a = exp(-dot(p, p) * 18.0) * vGlow * uPresence;
  gl_FragColor = vec4(vec3(1.0, 0.18, 0.28) * a * 2.0, a);
}
`;

export class Smoke {
  readonly group = new Group();
  private readonly quad = new PlaneGeometry(1, 1);
  private readonly material: ShaderMaterial;
  private readonly wisps: InstancedMesh;
  private readonly emberGeometry = new BufferGeometry();
  private readonly emberMaterial: ShaderMaterial;
  private readonly uniforms = { uTime: { value: 0 }, uPresence: { value: 0 }, uSpread: { value: 0 }, uPixelRatio: { value: 1 } };

  constructor(count: number, embers: number) {
    const random = createRandom(2002);
    this.material = new ShaderMaterial({
      vertexShader: smokeVertex, fragmentShader: smokeFragment, uniforms: this.uniforms,
      transparent: true, depthWrite: false, premultipliedAlpha: true,
    });
    this.wisps = new InstancedMesh(this.quad, this.material, count);
    const seeds = new Float32Array(count * 4), matrix = new Matrix4();
    for (let i = 0; i < count; i++) {
      // Wisps gather around the lower body and trail below it.
      const angle = random() * Math.PI * 2, radius = 0.4 + random() * 1.6;
      matrix.makeTranslation(Math.cos(angle) * radius, -1.5 - random() * 3.5, Math.sin(angle) * radius * 0.7 - 0.4);
      this.wisps.setMatrixAt(i, matrix);
      seeds.set([random(), random(), random(), random()], i * 4);
    }
    this.quad.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 4));
    this.wisps.frustumCulled = false;
    this.wisps.renderOrder = 3;

    const positions = new Float32Array(embers * 3), emberSeeds = new Float32Array(embers * 4);
    for (let i = 0; i < embers; i++) {
      positions.set([(random() - 0.5) * 14, -6 + random() * 3, (random() - 0.5) * 8 - 2], i * 3);
      emberSeeds.set([random(), random(), random(), random()], i * 4);
    }
    this.emberGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    this.emberGeometry.setAttribute("aSeed", new BufferAttribute(emberSeeds, 4));
    this.emberMaterial = new ShaderMaterial({
      vertexShader: emberVertex, fragmentShader: emberFragment, uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
    });
    const points = new Points(this.emberGeometry, this.emberMaterial);
    points.frustumCulled = false;
    this.group.add(this.wisps, points);
  }

  update(time: number, presence: number, spread: number, pixelRatio: number) {
    this.uniforms.uTime.value = time;
    this.uniforms.uPresence.value = presence;
    this.uniforms.uSpread.value = spread;
    this.uniforms.uPixelRatio.value = pixelRatio;
  }

  dispose() {
    this.quad.dispose(); this.material.dispose(); this.wisps.dispose();
    this.emberGeometry.dispose(); this.emberMaterial.dispose();
  }
}
