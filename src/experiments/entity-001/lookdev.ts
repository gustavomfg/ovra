import { Color, type Material, type MeshPhysicalMaterial, type MeshStandardMaterial } from "three";

// Runtime look development for the Blender materials. Base colors, roughness and
// coats live in the Blender pipeline (tools/blender/entity-001/common.py); this
// layer adds what glTF cannot carry: object-space roughness breakup, and a
// stronger environment response on the lens. Unknown materials pass through.
export type Look = {
  color?: string; metalness?: number; roughness?: number; normalScale?: number;
  clearcoat?: number; clearcoatRoughness?: number; envMapIntensity?: number;
  // Object-space roughness breakup: [amplitude, cycles per metre]. No UVs required.
  breakup?: [number, number];
};

export const LOOKS: Record<string, Look> = {
  M_Titanium: { breakup: [0.22, 24] },
  M_Brushed: { breakup: [0.18, 40] },
  M_Ceramic: { breakup: [0.14, 14] },
  M_Lens: { envMapIntensity: 1.4 },
};

const color = new Color();

export function applyLook(material: Material, look = LOOKS[material.name]) {
  if (!look) return false;
  const standard = material as MeshStandardMaterial;
  if (!standard.isMeshStandardMaterial) return false;
  if (look.color) standard.color.copy(color.set(look.color));
  if (look.metalness !== undefined) standard.metalness = look.metalness;
  if (look.roughness !== undefined) standard.roughness = look.roughness;
  if (look.envMapIntensity !== undefined) standard.envMapIntensity = look.envMapIntensity;
  if (look.normalScale !== undefined && standard.normalMap) standard.normalScale.setScalar(look.normalScale);
  const physical = material as MeshPhysicalMaterial;
  if (physical.isMeshPhysicalMaterial) {
    if (look.clearcoat !== undefined) physical.clearcoat = look.clearcoat;
    if (look.clearcoatRoughness !== undefined) physical.clearcoatRoughness = look.clearcoatRoughness;
  }
  if (look.breakup) addRoughnessBreakup(standard, look.breakup[0], look.breakup[1]);
  return true;
}

// Low-frequency value noise in object space varies roughness by a few percent,
// like handling marks and uneven finishing. It costs a handful of ALU per pixel.
function addRoughnessBreakup(material: MeshStandardMaterial, amplitude: number, frequency: number) {
  const key = `breakup:${amplitude}:${frequency}`;
  material.customProgramCacheKey = () => key;
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vOvraObject;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvOvraObject = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vOvraObject;
float ovraHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ovraNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ovraHash(i), ovraHash(i + vec3(1,0,0)), f.x), mix(ovraHash(i + vec3(0,1,0)), ovraHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(ovraHash(i + vec3(0,0,1)), ovraHash(i + vec3(1,0,1)), f.x), mix(ovraHash(i + vec3(0,1,1)), ovraHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
{
  vec3 q = vOvraObject * ${frequency.toFixed(3)};
  float n = ovraNoise(q) * 0.65 + ovraNoise(q * 3.1 + 7.0) * 0.35;
  roughnessFactor = clamp(roughnessFactor * (1.0 + (n - 0.5) * ${(amplitude * 2).toFixed(3)}), 0.04, 1.0);
}`);
  };
  material.needsUpdate = true;
}

export type SensorUniforms = { uAperture: { value: number }; uFocus: { value: number } };

// The pupil disc becomes an optical sensor: a dark aperture that dilates, a hot
// inner rim, radial emissive fibres and a soft outer falloff. It replaces a flat
// white disc that read as a sticker once tone mapped. Radius is the disc radius in
// the mesh's local units (the Blender pupil is 0.016 m).
export function makeSensor(material: MeshStandardMaterial, radius: number): SensorUniforms {
  const uniforms: SensorUniforms = { uAperture: { value: 0.32 }, uFocus: { value: 0 } };
  material.customProgramCacheKey = () => "ovra-sensor";
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vOvraDisc;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvOvraDisc = position.xy / ${radius.toFixed(5)};`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vOvraDisc;\nuniform float uAperture, uFocus;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
{
  float r = length(vOvraDisc);
  float a = atan(vOvraDisc.y, vOvraDisc.x);
  float aperture = uAperture;
  float hole = smoothstep(aperture - 0.03, aperture + 0.035, r);
  float rim = exp(-pow((r - aperture - 0.05) * 18.0, 2.0));
  float fibres = 0.62 + 0.38 * pow(0.5 + 0.5 * sin(a * 41.0 + sin(r * 23.0 + uFocus) * 1.6), 2.0);
  float ridge = 0.85 + 0.15 * sin(r * 70.0 - uFocus * 2.0);
  float body = mix(1.0, 0.34, smoothstep(aperture, 1.0, r)) * fibres * ridge;
  float glow = hole * (body * 0.78 + rim * 0.9) + (1.0 - hole) * 0.015;
  vec3 hot = vec3(1.0, 0.93, 0.82), warm = vec3(1.0, 0.62, 0.3);
  totalEmissiveRadiance *= glow * mix(hot, warm, smoothstep(aperture + 0.1, 1.0, r) * 0.85);
}`);
  };
  material.needsUpdate = true;
  return uniforms;
}
