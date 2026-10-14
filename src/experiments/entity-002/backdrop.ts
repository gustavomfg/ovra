import { Group, Mesh, PlaneGeometry, ShaderMaterial, type Camera } from "three";

const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const common = /* glsl */ `
float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5, v = 0.0; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
// A skyline of gothic towers: each cell holds a tower body with a pointed roof,
// and some carry a needle spire. Returns 1 inside the silhouette.
float skyline(vec2 uv, float seed, float density, float base, float height) {
  float x = uv.x * density;
  float cell = floor(x), f = fract(x);
  float inside = step(uv.y, base);
  for (int k = -1; k <= 1; k++) {
    float c = cell + float(k);
    float h = base + height * (0.3 + 0.7 * hash(c + seed));
    float w = (0.16 + 0.16 * hash(c * 1.7 + seed)) / density * 10.0 * 0.1;
    float cx = float(k) + 0.5 + (hash(c * 3.1 + seed) - 0.5) * 0.5;
    float dx = abs(f - cx) / density;
    float body = step(dx, w) * step(uv.y, h);
    float roof = step(dx, w) * step(uv.y, h + (w - dx) * 2.2);
    float spire = hash(c * 5.3 + seed) > 0.55 ? step(dx, w * 0.12) * step(uv.y, h + w * 2.2 + height * 0.35 * (1.0 - dx / (w * 0.12))) : 0.0;
    // Twin pinnacles on the shoulders of the larger towers.
    float pin = step(0.5, hash(c * 7.7 + seed)) * step(abs(dx - w * 0.85), w * 0.12) * step(uv.y, h + w * 0.9);
    inside = max(inside, max(max(body, roof), max(spire, pin)));
  }
  return inside;
}
`;

// Far layer: sky, eclipse and mist.
const skyFragment = /* glsl */ `
uniform float uTime, uPresence;
varying vec2 vUv;
${common}
void main() {
  vec2 uv = vUv;
  vec3 top = vec3(0.012, 0.008, 0.02), horizon = vec3(0.07, 0.045, 0.09);
  vec3 color = mix(horizon, top, smoothstep(0.25, 1.0, uv.y));
  // Clouds drifting across the sky.
  float cloud = fbm(uv * vec2(3.0, 5.0) + vec2(uTime * 0.008, 0.0));
  color += vec3(0.05, 0.035, 0.07) * smoothstep(0.45, 0.85, cloud) * smoothstep(0.3, 0.9, uv.y);
  // Eclipse: a black disc whose corona flares on the upper right edge.
  vec2 m = (uv - vec2(0.64, 0.74)) * vec2(1.55, 1.0);
  float r = length(m);
  float angle = atan(m.y, m.x);
  float edge = exp(-pow((r - 0.075) * 110.0, 2.0));
  float bias = 0.25 + 0.75 * pow(0.5 + 0.5 * cos(angle - 0.7), 3.0);
  float corona = exp(-max(0.0, r - 0.075) * 22.0) * 0.3;
  float rays = 0.6 + 0.4 * fbm(vec2(angle * 6.0, r * 8.0 - uTime * 0.05));
  color += vec3(0.85, 0.82, 1.0) * (edge * 2.6 * bias + corona * bias * rays);
  color = mix(color, vec3(0.008, 0.005, 0.012), smoothstep(0.077, 0.071, r));
  // Far towers dissolve into haze.
  float far = skyline(uv + vec2(0.13, 0.0), 11.0, 14.0, 0.22, 0.13);
  // Distant towers sink into haze toward their base.
  color = mix(color, vec3(0.05, 0.034, 0.066), far * 0.55 * smoothstep(0.12, 0.3, uv.y));
  gl_FragColor = vec4(color * uPresence, 1.0);
}
`;

// Near layer: dark towers with lit windows, then low mist rolling in front.
const nearFragment = /* glsl */ `
uniform float uTime, uPresence;
varying vec2 vUv;
${common}
void main() {
  vec2 uv = vUv;
  float mid = skyline(uv + vec2(0.4, 0.0), 23.0, 8.0, 0.2, 0.32);
  float gap = smoothstep(0.16, 0.3, abs(uv.x - 0.5));
  mid *= gap;
  vec3 color = vec3(0.012, 0.008, 0.018);
  float alpha = mid;
  // Windows and lanterns: sparse flickering crimson points inside the towers.
  vec2 grid = uv * vec2(90.0, 60.0);
  float lamp = step(0.985, hash2(floor(grid))) * mid;
  float flicker = 0.6 + 0.4 * sin(uTime * (3.0 + hash2(floor(grid)) * 5.0));
  vec2 g = fract(grid) - 0.5;
  color += vec3(1.0, 0.12, 0.2) * lamp * flicker * exp(-dot(g, g) * 20.0) * 3.0;
  // Mist that rises from below and sits between the creature and the city.
  float mist = fbm(uv * vec2(2.5, 6.0) + vec2(uTime * 0.02, -uTime * 0.01));
  float band = smoothstep(0.5, 0.12, uv.y) * (0.45 + 0.55 * mist);
  color = mix(color, vec3(0.08, 0.045, 0.1), band * 0.7);
  alpha = max(alpha, band * 0.8);
  gl_FragColor = vec4(color * uPresence, alpha);
}
`;

export class Backdrop {
  readonly group = new Group();
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly uniforms = { uTime: { value: 0 }, uPresence: { value: 0 } };
  private readonly sky = new ShaderMaterial({ vertexShader: vertex, fragmentShader: skyFragment, uniforms: this.uniforms, depthWrite: false, fog: false });
  private readonly near = new ShaderMaterial({ vertexShader: vertex, fragmentShader: nearFragment, uniforms: this.uniforms, depthWrite: false, transparent: true, fog: false });
  private readonly layers: { mesh: Mesh; distance: number; size: [number, number] }[] = [];

  constructor() {
    for (const [material, distance, size, order] of [[this.sky, 46, [96, 62], -10], [this.near, 30, [64, 40], -9]] as const) {
      const mesh = new Mesh(this.geometry, material);
      mesh.renderOrder = order; mesh.frustumCulled = false;
      this.layers.push({ mesh, distance, size: [size[0], size[1]] });
      this.group.add(mesh);
    }
  }

  // The layers hang behind the creature at fixed depths and face the camera;
  // camera drift therefore shows parallax between sky, city and mist.
  update(camera: Camera, time: number, presence: number) {
    this.uniforms.uTime.value = time;
    this.uniforms.uPresence.value = presence;
    for (const { mesh, distance, size } of this.layers) {
      mesh.quaternion.copy(camera.quaternion);
      mesh.position.set(camera.position.x * 0.2, camera.position.y * 0.2 + 2, -distance + camera.position.z * 0.1);
      mesh.scale.set(size[0], size[1], 1);
    }
  }

  dispose() { this.geometry.dispose(); this.sky.dispose(); this.near.dispose(); }
}
