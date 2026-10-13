import { describe, expect, it } from "vitest";
import { MeshPhysicalMaterial, MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from "three";
import { applyLook, makeSensor } from "./lookdev";

const shader = () => ({
  uniforms: {},
  vertexShader: "#include <common>\n#include <begin_vertex>",
  fragmentShader: "#include <common>\n#include <roughnessmap_fragment>\n#include <emissivemap_fragment>",
}) as unknown as WebGLProgramParametersWithUniforms;

describe("look development", () => {
  it("adds roughness breakup without UVs and leaves unknown materials alone", () => {
    const titanium = new MeshStandardMaterial({ roughness: 0.38 }); titanium.name = "M_Titanium";
    expect(applyLook(titanium)).toBe(true);
    const compiled = shader();
    titanium.onBeforeCompile(compiled, undefined as never);
    expect(compiled.fragmentShader).toContain("ovraNoise");
    expect(compiled.vertexShader).toContain("vOvraObject = position");
    expect(titanium.roughness).toBe(0.38);
    const other = new MeshStandardMaterial(); other.name = "M_Other";
    expect(applyLook(other)).toBe(false);
  });
  it("applies physical overrides only where the material supports them", () => {
    const lens = new MeshPhysicalMaterial(); lens.name = "M_Lens";
    applyLook(lens, { envMapIntensity: 1.4, clearcoat: 1 });
    expect(lens.envMapIntensity).toBe(1.4);
    expect(lens.clearcoat).toBe(1);
  });
  it("drives the sensor aperture through shared uniforms", () => {
    const pupil = new MeshStandardMaterial({ emissive: "#ffffff" });
    const uniforms = makeSensor(pupil, 0.016);
    const compiled = shader();
    pupil.onBeforeCompile(compiled, undefined as never);
    expect(compiled.fragmentShader).toContain("uAperture");
    uniforms.uAperture.value = 0.4;
    expect((compiled.uniforms as Record<string, { value: number }>).uAperture.value).toBe(0.4);
  });
});
