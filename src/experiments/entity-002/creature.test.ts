import { describe, expect, it, vi } from "vitest";
import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, Texture } from "three";
import { loadGltf } from "../../core/assets";
import { Creature, type CreatureInput } from "./creature";

vi.mock("../../core/assets", () => ({ loadGltf: vi.fn() }));

const input: CreatureInput = {
  dt: 1/60, time: 0, reduced: false, materialize: 1, eyePresence: 1,
  lookYaw: .2, lookPitch: -.1, lookRoll: .03, gazeX: .4, gazeY: .2,
  openness: .8, reach: .8, reachX: .6, reachY: .2, startle: .2, amusement: .4, dilation: .6,
};
function fixture() {
  const root = new Group(); root.name = "UMBRA_ROOT";
  for (const name of ["CTRL_BODY", "CTRL_LOOK", "CTRL_HEAD", "CTRL_EYE_L", "CTRL_EYE_R"]) {
    const node = new Group(); node.name = name; root.add(node);
  }
  for (const side of ["L", "R"]) for (const part of ["SHOULDER", "ELBOW", "WRIST", ...Array.from({length: 5}, (_, i) => `CLAW_${side}_${i}`)]) {
    const node = new Group(); node.name = part.startsWith("CLAW") ? `CTRL_${part}` : `CTRL_${part}_${side}`; root.add(node);
  }
  const texture = new Texture();
  const material = new MeshPhysicalMaterial({ normalMap: texture }); material.name = "M_Shadow";
  const geometry = new BoxGeometry(); const mesh = new Mesh(geometry, material); root.add(mesh);
  vi.mocked(loadGltf).mockResolvedValue({ scene: root, animations: [] } as never);
  return { root, material, geometry, texture };
}

describe("UMBRA creature lifecycle", () => {
  it("owns its resources while preserving the shared model and embedded textures", async () => {
    const original = fixture();
    const sourceGeometry = vi.spyOn(original.geometry, "dispose"), sourceMaterial = vi.spyOn(original.material, "dispose");
    const sourceTexture = vi.spyOn(original.texture, "dispose");
    const creature = await Creature.load("umbra.glb");
    const mesh = creature.root.children.find(node => (node as Mesh).isMesh) as Mesh;
    expect(mesh.geometry).not.toBe(original.geometry);
    expect(mesh.material).not.toBe(original.material);
    expect((mesh.material as MeshPhysicalMaterial).normalMap).toBe(original.texture);
    const owned = vi.spyOn(mesh.geometry, "dispose");
    creature.update(input); creature.dispose(); creature.dispose();
    expect(owned).toHaveBeenCalledTimes(1);
    expect(sourceGeometry).not.toHaveBeenCalled(); expect(sourceMaterial).not.toHaveBeenCalled(); expect(sourceTexture).not.toHaveBeenCalled();
    expect(original.root.scale.x).toBe(1);
    expect(original.root.getObjectByName("CTRL_LOOK")?.quaternion.w).toBe(1);
  });
  it("settles all spatial layers and pupil motion with reduced motion", async () => {
    fixture(); const creature = await Creature.load("umbra.glb");
    creature.update(input);
    creature.update({...input, reduced: true, time: 12});
    const first = creature.root.getObjectByName("CTRL_WRIST_L")!.quaternion.clone();
    const head = creature.root.getObjectByName("CTRL_LOOK")!.quaternion.clone();
    creature.update({...input, reduced: true, time: 55, gazeX: -1, gazeY: -1, reachX: -1, dilation: .1});
    expect(creature.root.getObjectByName("CTRL_WRIST_L")!.quaternion.equals(first)).toBe(true);
    expect(creature.root.getObjectByName("CTRL_LOOK")!.quaternion.equals(head)).toBe(true);
    expect(creature.uniforms.uWind.value).toBe(0);
    expect(creature.uniforms.uTime.value).toBe(0);
    expect(creature.uniforms.uSlit.value).toBe(.13);
    expect(Math.hypot(creature.uniforms.uGaze.value.x, creature.uniforms.uGaze.value.y)).toBe(0);
    creature.dispose();
  });
  it("reveals the eyes while the body is still in darkness", async () => {
    fixture(); const creature = await Creature.load("umbra.glb");
    creature.update({...input, materialize: 0, eyePresence: .7});
    expect(creature.uniforms.uMaterialize.value).toBe(0);
    expect(creature.uniforms.uEyeGlow.value).toBeGreaterThan(.5);
    creature.dispose();
  });
});
