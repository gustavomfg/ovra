import { Euler, Quaternion, type BufferGeometry, type Material, type Mesh, type Object3D } from "three";
import { loadGltf } from "../../core/assets";
import { clamp } from "../../core/math";
import { Spring } from "../../core/spring";
import { createUniforms, dress, type CreatureUniforms } from "./materials";

export const CREATURE_SCALE = 4;
// The Blender root sits at the floor; this lifts the chest to the scene origin.
const ORIGIN_HEIGHT = 0.95;

export function creatureUrl(base: string, compact: boolean) {
  return `${base}3d/entity-002/umbra-${compact ? "optimized" : "cinematic"}.glb`;
}

export type CreatureInput = {
  dt: number; time: number; reduced: boolean;
  // 0..1 during the opening, 1 afterwards.
  materialize: number;
  // Head turn (radians) and eye-in-head gaze (-1..1).
  lookYaw: number; lookPitch: number; lookRoll: number; gazeX: number; gazeY: number;
  // Lid opening 0..1 (blinks included).
  openness: number;
  // Hand reaching toward the visitor 0..1, and the cursor side (-1 left .. 1 right).
  reach: number; reachX: number; reachY: number;
  // Startle (flinch, flare, spread) and amusement (grin glow, shoulders) 0..1.
  startle: number; amusement: number;
  // Pupil width 0..1 (0 = needle slit).
  dilation: number;
};

type Joint = { node: Object3D; rest: Quaternion };

export class Creature {
  readonly root: Object3D;
  readonly uniforms: CreatureUniforms = createUniforms();
  private readonly body: Object3D;
  private readonly look: Object3D;
  private readonly eyes: Object3D[];
  private readonly eyeRest: number[];
  private readonly joints: Record<string, Joint> = {};
  private readonly maw: Material[] = [];
  private readonly gem: Material[] = [];
  private readonly ownedMaterials: Material[] = [];
  private readonly ownedGeometry: BufferGeometry[] = [];
  private readonly lookRest: Quaternion;
  private readonly bodyRest: number;
  private readonly reach = new Spring(0, 9);
  private readonly startle = new Spring(0, 60);
  private readonly euler = new Euler(0, 0, 0, "YXZ");
  private readonly rotation = new Quaternion();
  private disposed = false;

  private constructor(root: Object3D) {
    this.root = root;
    root.scale.setScalar(CREATURE_SCALE);
    root.position.set(0, -ORIGIN_HEIGHT * CREATURE_SCALE, 0);
    const find = (name: string) => {
      const node = root.getObjectByName(name);
      if (!node) throw new Error(`ENTITY 002 model is missing ${name}`);
      return node;
    };
    this.body = find("CTRL_BODY");
    this.bodyRest = this.body.position.y;
    this.look = find("CTRL_LOOK");
    this.lookRest = this.look.quaternion.clone();
    this.eyes = [find("CTRL_EYE_L"), find("CTRL_EYE_R")];
    this.eyeRest = this.eyes.map(eye => eye.scale.y);
    for (const name of ["CTRL_SHOULDER_L", "CTRL_SHOULDER_R", "CTRL_ELBOW_L", "CTRL_ELBOW_R", "CTRL_WRIST_L", "CTRL_WRIST_R", "CTRL_HEAD"]) {
      const node = find(name);
      this.joints[name] = { node, rest: node.quaternion.clone() };
    }
    // Each mounted creature owns its geometry and materials; the loader cache stays intact.
    const materials = new Map<Material, Material>();
    root.traverse(node => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry = mesh.geometry.clone(); this.ownedGeometry.push(mesh.geometry);
      mesh.frustumCulled = false;
      const source = mesh.material as Material;
      const role = String(mesh.userData.ovra_role ?? mesh.parent?.userData.ovra_role ?? "");
      const side = mesh.name.endsWith("_R") ? -1 : 1;
      // Eyes get one material each: the slit shader depends on the side.
      let material = role === "eye" ? undefined : materials.get(source);
      if (!material) {
        material = source.clone(); this.ownedMaterials.push(material);
        if (role !== "eye") materials.set(source, material);
        const kind = role === "tatter" ? "tatter" : role === "eye" ? "eye" : role === "gem" || role === "maw" ? "glow" : "skin";
        dress(material, this.uniforms, { kind, side });
        if (role === "maw") this.maw.push(material);
        if (role === "gem") this.gem.push(material);
      }
      mesh.material = material;
    });
  }

  static async load(url: string) {
    const gltf = await loadGltf(url);
    return new Creature(gltf.scene.clone(true));
  }

  update(input: CreatureInput) {
    if (this.disposed) return;
    const dt = clamp(input.dt, 0, 0.1);
    const u = this.uniforms;
    const motion = input.reduced ? 0 : 1;
    const t = input.time;
    u.uTime.value = input.reduced ? 0 : t;
    u.uMaterialize.value = input.materialize;
    const startle = this.startle.step(input.startle, dt);
    u.uFlare.value = startle * motion;
    u.uWind.value = motion * (0.8 + startle * 0.8);
    u.uEmber.value = 0.85 + input.amusement * 0.5 + startle * 0.4;
    u.uGaze.value.x = input.gazeX * motion; u.uGaze.value.y = input.gazeY * motion;
    u.uSlit.value = 0.16 + 0.34 * clamp(input.dilation);
    u.uEyeGlow.value = input.materialize ** 3 * (0.9 + input.amusement * 0.25);

    // Floating: a slow heave with a hitch, never a metronome; a flinch pulls back.
    const heave = (Math.sin(t * 0.85) + Math.sin(t * 1.37 + 0.6) * 0.35) * 0.022 * motion;
    this.body.position.y = this.bodyRest + heave;
    this.body.position.z = -startle * 0.06 * motion;
    this.body.rotation.z = Math.sin(t * 0.43) * 0.025 * motion;

    this.look.quaternion.copy(this.lookRest).multiply(this.rotation.setFromEuler(
      this.euler.set(input.lookPitch * motion - startle * 0.12 * motion, input.lookYaw * motion, input.lookRoll * motion)));

    // Lids are the eye's own squash: a blink closes the almond toward its centre.
    this.eyes.forEach((eye, i) => { eye.scale.y = this.eyeRest[i] * clamp(input.openness, 0.04, 1); });

    // Arms: idle claws flex and shoulders breathe; the hand on the visitor's side
    // reaches out when curious; a startle throws both arms back and wide.
    const reach = this.reach.step(clamp(input.reach), dt) * motion;
    // Axes, for an arm along ±X: rotating about Y by -side·θ swings it toward the
    // viewer (+Z); about Z by +side·θ lifts it. The arm on the cursor's side
    // (L is +X, screen right) does the reaching.
    for (const [side, key] of [[1, "L"], [-1, "R"]] as const) {
      const toward = clamp(input.reachX * side * 1.6 + 0.5, 0, 1) * reach;
      const breathe = Math.sin(t * 0.85 + side) * 0.05 * motion;
      const flinch = startle * motion;
      this.pose(`CTRL_SHOULDER_${key}`, breathe,
        -side * (0.35 + 0.75 * toward - flinch * 0.45),
        side * (-0.2 + 0.25 * toward + input.reachY * 0.25 * toward + flinch * 0.35));
      this.pose(`CTRL_ELBOW_${key}`, -0.2 * (1 - toward) + flinch * 0.2, -side * (0.3 - 0.28 * toward), 0);
      const flex = (Math.sin(t * 1.3 + side * 2) * 0.5 + 0.5) * 0.25 * motion;
      // Claws open as the hand reaches and curl when it rests.
      this.pose(`CTRL_WRIST_${key}`, flex * (1 - toward) - 0.25 * toward, 0, side * (input.amusement * 0.15 * Math.sin(t * 9) * motion));
    }
    // Amusement shakes the head in a silent laugh.
    this.pose("CTRL_HEAD", input.amusement * Math.sin(t * 13) * 0.025 * motion, 0, 0);

    const grin = 0.4 + input.amusement * 2.4 + startle * 0.6;
    for (const material of this.maw) (material as unknown as { emissiveIntensity: number }).emissiveIntensity = grin * input.materialize;
    const beat = Math.pow(Math.max(0, Math.sin(t * 2.1)), 12) * motion;
    for (const material of this.gem) (material as unknown as { emissiveIntensity: number }).emissiveIntensity = (0.9 + beat * 1.6) * input.materialize;
  }

  private pose(name: string, x: number, y: number, z: number) {
    const joint = this.joints[name];
    joint.node.quaternion.copy(joint.rest).multiply(this.rotation.setFromEuler(this.euler.set(x, y, z)));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.ownedGeometry.forEach(geometry => geometry.dispose());
    this.ownedMaterials.forEach(material => material.dispose());
  }
}
