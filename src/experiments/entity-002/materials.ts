import { Color, type Material, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from "three";

// One set of uniforms per instance. Texture normals and roughness come from the
// Blender asset; only cloth motion, the optical iris and the reveal are live.
export type CreatureUniforms = {
  uTime: { value: number }; uMaterialize: { value: number }; uRim: { value: number };
  uRimColor: { value: Color }; uWind: { value: number }; uFlare: { value: number };
  uEmber: { value: number }; uEmberColor: { value: Color };
  uGaze: { value: { x: number; y: number } }; uSlit: { value: number }; uEyeGlow: { value: number };
};
export function createUniforms(): CreatureUniforms {
  return {
    uTime: { value: 0 }, uMaterialize: { value: 1 }, uRim: { value: 1 },
    uRimColor: { value: new Color("#857d9c") }, uWind: { value: 1 }, uFlare: { value: 0 },
    uEmber: { value: 1 }, uEmberColor: { value: new Color("#a22b54") },
    uGaze: { value: { x: 0, y: 0 } }, uSlit: { value: .13 }, uEyeGlow: { value: 1 },
  };
}
type Kind = "skin" | "tatter" | "eye" | "glow" | "plain";

export function dress(material: Material, uniforms: CreatureUniforms, { kind, side = 1 }: { kind: Kind; side?: number }) {
  const standard = material as MeshStandardMaterial;
  if (!standard.isMeshStandardMaterial) return;
  const cloth = kind === "tatter";
  if (cloth) { standard.vertexColors = false; standard.side = 2; }
  standard.customProgramCacheKey = () => `umbra-${kind}-${side}-reference-v2`;
  standard.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
uniform float uTime, uWind, uFlare;
varying vec3 vUmbraObject;
${cloth ? "attribute vec4 color; varying vec2 vUmbraCloth;" : ""}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
vUmbraObject = position;
${cloth ? `
  vUmbraCloth = color.rg;
  float phase = uTime * .68 + position.y * 3.2 + position.x * 2.6;
  vec3 wind = vec3(sin(phase) * .7 + sin(phase * 1.43 + 1.3) * .3,
                   sin(phase * .79 + 2.1) * .20, sin(phase * 1.12) * .42);
  vec3 outward = normalize(vec3(position.x, 0.0, position.z) + 1e-4);
  transformed += (wind * .026 * uWind + outward * .035 * uFlare) * pow(color.r, 1.6);
` : ""}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uTime, uMaterialize, uRim, uEmber, uSlit, uEyeGlow;
uniform vec3 uRimColor, uEmberColor; uniform vec2 uGaze;
varying vec3 vUmbraObject;
${cloth ? "varying vec2 vUmbraCloth;" : ""}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
{
  ${kind === "eye" ? eyeShader(side) : `
  float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));
  float rim = pow(1.0 - facing, 4.0);
  totalEmissiveRadiance += uRimColor * rim * uRim * .075;
  ${cloth ? "totalEmissiveRadiance += uEmberColor * pow(vUmbraCloth.y, 3.0) * .16 * uEmber;" : ""}
  totalEmissiveRadiance *= uMaterialize;`}
}`)
      .replace("#include <opaque_fragment>", `${kind === "eye" ? "" : "outgoingLight *= uMaterialize;"}
#include <opaque_fragment>`);
  };
  standard.needsUpdate = true;
}

function eyeShader(side: number) {
  const a = side * 27 * Math.PI / 180;
  return `
  float c = ${Math.cos(a).toFixed(6)}, s = ${Math.sin(a).toFixed(6)};
  vec2 q = vec2(vUmbraObject.x * c + vUmbraObject.y * s, -vUmbraObject.x * s + vUmbraObject.y * c) / vec2(.115, .058);
  vec2 d = q - vec2(uGaze.x * .28, uGaze.y * .18);
  float slit = 1.0 - smoothstep(uSlit * .55, uSlit, abs(d.x) / max(.18, 1.0 - d.y * d.y));
  float r = length(q);
  float lid = 1.0 - smoothstep(.68, 1.0, r);
  float iris = 1.0 - smoothstep(.15, .95, length(d * vec2(.85, .8)));
  float fibres = .86 + .14 * sin(atan(d.y, d.x) * 37.0 + length(d) * 15.0);
  vec3 eye = mix(vec3(.55, .008, .11), vec3(1.0, .19, .38), iris) * fibres * lid;
  totalEmissiveRadiance = eye * (1.0 - slit * .997) * 1.65 * uEyeGlow;`;
}
