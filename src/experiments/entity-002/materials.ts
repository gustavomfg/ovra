import { Color, type Material, type MeshPhysicalMaterial, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from "three";

// Uniforms shared by every material of one creature, written once per frame.
export type CreatureUniforms = {
  uTime: { value: number };
  // 0 = not yet materialized (all dissolved), 1 = solid.
  uMaterialize: { value: number };
  // Violet rim light from the creature's own aura.
  uRim: { value: number };
  uRimColor: { value: Color };
  // Wind strength on tatters, and how far they flare outward when startled.
  uWind: { value: number };
  uFlare: { value: number };
  // Glow on torn edges, and the eyes' gaze, pupil width and intensity.
  uEmber: { value: number };
  uEmberColor: { value: Color };
  uGaze: { value: { x: number; y: number } };
  uSlit: { value: number };
  uEyeGlow: { value: number };
};

export function createUniforms(): CreatureUniforms {
  return {
    uTime: { value: 0 }, uMaterialize: { value: 1 }, uRim: { value: 1 },
    uRimColor: { value: new Color("#7a3cff") }, uWind: { value: 1 }, uFlare: { value: 0 },
    uEmber: { value: 1 }, uEmberColor: { value: new Color("#ff1f4a") },
    uGaze: { value: { x: 0, y: 0 } }, uSlit: { value: 0.18 }, uEyeGlow: { value: 1 },
  };
}

const NOISE = /* glsl */ `
float umbraHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float umbraNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(umbraHash(i), umbraHash(i + vec3(1,0,0)), f.x), mix(umbraHash(i + vec3(0,1,0)), umbraHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(umbraHash(i + vec3(0,0,1)), umbraHash(i + vec3(1,0,1)), f.x), mix(umbraHash(i + vec3(0,1,1)), umbraHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float umbraFbm(vec3 p) { return umbraNoise(p) * 0.55 + umbraNoise(p * 2.03 + 3.1) * 0.3 + umbraNoise(p * 4.1 + 7.7) * 0.15; }
`;

type Kind = "skin" | "tatter" | "eye" | "glow" | "plain";
type Options = { kind: Kind; side?: number };

// Patches a glTF material in place. Every kind shares the materialize dissolve and
// the violet rim; tatters add wind and burning edges; eyes draw a slit pupil.
export function dress(material: Material, uniforms: CreatureUniforms, options: Options) {
  const standard = material as MeshStandardMaterial;
  if (!standard.isMeshStandardMaterial) return;
  const { kind, side = 1 } = options;
  if (kind === "tatter") { standard.vertexColors = false; standard.side = 2; standard.transparent = false; }
  // Shadow flesh absorbs light: a dull sheen and a thin coat, not glossy vinyl.
  const physical = material as MeshPhysicalMaterial;
  if (kind === "skin" && physical.isMeshPhysicalMaterial) {
    physical.sheen *= 0.55; physical.clearcoat = Math.min(physical.clearcoat, 0.12);
    physical.roughness = Math.max(physical.roughness, 0.58);
    physical.color.multiplyScalar(1.8);
  }
  standard.customProgramCacheKey = () => `umbra-${kind}-${side}`;
  standard.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    const tatter = kind === "tatter";
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
uniform float uTime, uWind, uFlare;
varying vec3 vUmbraObject;
${tatter ? "attribute vec4 color;\nvarying vec2 vUmbraCloth;" : ""}
${NOISE}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
vUmbraObject = position;
${tatter ? `
  float flutter = color.r;
  vUmbraCloth = color.rg;
  float phase = uTime * 1.6 + position.y * 7.0 + position.x * 5.0;
  vec3 wind = vec3(sin(phase) * 0.6 + sin(phase * 1.7 + 1.3) * 0.4,
                   sin(phase * 0.8 + 2.1) * 0.25,
                   0.55 + sin(phase * 1.1) * 0.45);
  float gust = 0.6 + 0.4 * umbraNoise(vec3(position.xy * 3.0, uTime * 0.35));
  vec3 outward = normalize(vec3(position.x, 0.0, position.z) + 1e-4);
  transformed += (wind * 0.045 * gust * uWind + outward * 0.09 * uFlare) * pow(flutter, 1.4);
` : ""}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uTime, uMaterialize, uRim, uEmber, uSlit, uEyeGlow;
uniform vec3 uRimColor, uEmberColor;
uniform vec2 uGaze;
varying vec3 vUmbraObject;
${tatter ? "varying vec2 vUmbraCloth;" : ""}
${NOISE}`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
{
  // Materialize: matter gathers out of noise; tatter tips always fray into smoke.
  float n = umbraFbm(vUmbraObject * 9.0 + vec3(0.0, uTime * 0.25, 0.0));
  float threshold = 1.0 - uMaterialize;
  ${tatter ? "threshold = max(threshold, (vUmbraCloth.x - 0.72) * 2.2);" : ""}
  if (n < threshold) discard;
}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
{
  vec3 viewDir = normalize(vViewPosition);
  float facing = abs(dot(normalize(vNormal), viewDir));
  float rim = pow(1.0 - facing, 3.0);
  ${kind === "eye" ? eyeShader(side) : kind === "glow" ? "" : "totalEmissiveRadiance += uRimColor * rim * rim * uRim * 0.35;"}
  ${tatter ? `
  float burn = vUmbraCloth.y * (0.65 + 0.35 * umbraNoise(vUmbraObject * 30.0 + uTime * 0.8));
  totalEmissiveRadiance += uEmberColor * burn * burn * 2.2 * uEmber;
  // Near the dissolve edge the cloth smoulders.
  float n2 = umbraFbm(vUmbraObject * 9.0 + vec3(0.0, uTime * 0.25, 0.0));
  float edge = 1.0 - smoothstep(0.0, 0.06, n2 - (vUmbraCloth.x - 0.72) * 2.2);
  totalEmissiveRadiance += uEmberColor * edge * 1.4 * uEmber;` : ""}
  {
    float n3 = umbraFbm(vUmbraObject * 9.0 + vec3(0.0, uTime * 0.25, 0.0));
    float rise = 1.0 - smoothstep(0.0, 0.05, n3 - (1.0 - uMaterialize));
    totalEmissiveRadiance += uEmberColor * rise * 3.0 * step(uMaterialize, 0.999);
  }
}`);
  };
  standard.needsUpdate = true;
}

// An almond of burning colour with a vertical slit that tracks the visitor. The
// eye mesh is a slanted ellipsoid; undo the slant to get almond coordinates.
function eyeShader(side: number) {
  const angle = (side * 22 * Math.PI) / 180;
  return `
  vec3 p = vUmbraObject;
  float c = ${Math.cos(angle).toFixed(5)}, s = ${Math.sin(angle).toFixed(5)};
  vec2 q = vec2(p.x * c + p.y * s, -p.x * s + p.y * c) / vec2(0.075, 0.026);
  float r = length(q);
  vec2 pupilCentre = vec2(uGaze.x * 0.42, uGaze.y * 0.25);
  vec2 d = q - pupilCentre;
  float slit = smoothstep(uSlit, uSlit * 0.55, abs(d.x) / max(0.15, 1.0 - d.y * d.y));
  float iris = 1.0 - smoothstep(0.35, 1.0, length(d * vec2(0.9, 1.4)));
  float lid = smoothstep(1.0, 0.55, r);
  vec3 hot = vec3(1.0, 0.3, 0.38), deep = vec3(0.8, 0.02, 0.12);
  vec3 eye = mix(deep, hot, iris * 0.85) * (0.55 + 0.9 * iris) * lid * (1.0 - slit * 0.96);
  totalEmissiveRadiance = eye * 2.4 * uEyeGlow;`;
}
