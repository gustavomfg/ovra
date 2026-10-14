import {
  ACESFilmicToneMapping, Color, DirectionalLight, FogExp2, Group, PointLight, Scene, Vector3, WebGLRenderer,
} from "three";
import { CameraRig, type CameraGoal } from "../../core/camera";
import { createFrameLoop } from "../../core/frameLoop";
import { createStudioEnvironment, disposeEnvironment, type Softbox } from "../../core/lighting";
import { clamp, damp, lerp } from "../../core/math";
import { createPostProcessing } from "../../core/postprocessing";
import { Spring } from "../../core/spring";
import { createTemperament, stepTemperament } from "../entity-001/behavior";
import { Perception } from "../entity-001/perception";
import { Backdrop } from "./backdrop";
import { Creature, creatureUrl } from "./creature";
import { INTRO_SECONDS, LABELS, laughEnvelope, opening, reactionFor, type Reaction } from "./direction";
import { Smoke } from "./smoke";

export type UmbraOptions = {
  canvas: HTMLCanvasElement; compact: boolean; reduced: boolean;
  onState(label: string): void; onContextLost(): void; onEnergy?(value: number): void;
};
export type UmbraScene = {
  setSize(width: number, height: number): void; setVisible(visible: boolean): void;
  setReduced(reduced: boolean): void; pointer(x: number, y: number): void;
  leave(): void; tap(x: number, y: number): void; dispose(): void;
};

const VOID = "#07050a";
// A low, heroic camera looking up at the creature, offset so the eclipse sits
// over its right shoulder.
export const CAMERA: CameraGoal = { distance: 19.5, orbit: 0.24, height: -0.1, fov: 32 };
const CAMERA_OPENING: CameraGoal = { distance: 23, orbit: 0.1, height: -0.18, fov: 34 };
// Reflections: a cold moon strip behind, a violet fill and a crimson glow from below.
const SOFTBOXES: Softbox[] = [
  { color: "#c9ccff", intensity: 2.4, position: [6, 9, -7], size: [3, 9] },
  { color: "#8a5cff", intensity: 1.1, position: [-9, 2, 4], size: [2, 8] },
  { color: "#ff2448", intensity: 0.9, position: [1, -8, 5], size: [8, 3] },
  { color: "#3a2a55", intensity: 0.35, position: [0, 2, 10], size: [8, 6] },
];

export function createUmbraScene(options: UmbraOptions): UmbraScene {
  const { canvas } = options;
  let reduced = options.reduced, disposed = false;
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  const releases: (() => void)[] = [() => { renderer.dispose(); if (!renderer.getContext().isContextLost()) renderer.forceContextLoss(); }];
  const free = () => releases.splice(0).reverse().forEach(release => { try { release(); } catch { /* keep releasing */ } });
  try {
    renderer.setClearColor(VOID, 1);
    renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    const scene = new Scene();
    scene.fog = new FogExp2("#0c0710", 0.016);
    const environment = createStudioEnvironment(renderer, SOFTBOXES, VOID);
    releases.push(() => disposeEnvironment(environment));
    scene.environment = environment; scene.environmentIntensity = 0.35;
    const moon = new DirectionalLight("#d6d8ff", 0); moon.position.set(6, 9, -6);
    const fill = new DirectionalLight("#7f5cd6", 0); fill.position.set(-7, 2, 6);
    const ember = new PointLight("#ff2a4a", 0, 22, 2); ember.position.set(0.3, -2.4, 5.5);
    // A faint cold key from high front-left gives the skull its planes.
    const key = new DirectionalLight("#b8b4ff", 0); key.position.set(-5, 6, 8);
    scene.add(moon, fill, ember, key);

    const rig = new CameraRig(reduced ? CAMERA : CAMERA_OPENING, 1.4, 15);
    rig.setFocus(0, 0.9, 0);
    const group = new Group(); group.rotation.order = "YXZ"; scene.add(group);
    const backdrop = new Backdrop(); scene.add(backdrop.group);
    const smoke = new Smoke(options.compact ? 18 : 34, options.compact ? 60 : 140); scene.add(smoke.group);
    releases.push(() => backdrop.dispose(), () => smoke.dispose());

    let creature: Creature | null = null;
    canvas.dataset.character = "loading";
    Creature.load(creatureUrl(import.meta.env.BASE_URL, options.compact)).then(loaded => {
      if (disposed) { loaded.dispose(); return; }
      creature = loaded; group.add(loaded.root); releases.push(() => loaded.dispose());
      canvas.dataset.character = "ready";
    }).catch(() => { canvas.dataset.character = "failed"; options.onState("silêncio"); });

    const post = createPostProcessing(renderer, scene, rig.camera, 1, 1);
    releases.push(() => post.dispose());
    post.bloom.threshold = 1.0; post.bloom.radius = 0.5;

    let temperament = createTemperament();
    const reaction: Reaction = reactionFor("observing");
    const perception = new Perception(0x0b2a);
    const yaw = new Spring(0, 10), pitch = new Spring(0, 10), roll = new Spring(0, 8), bodyYaw = new Spring(0, 4);
    const cursor = { x: 0, y: 0 }, previous = { x: 0, y: 0 };
    let present = false, speed = 0, story = reduced ? INTRO_SECONDS : 0, laughAt = -10, now = 0, lastLabel = "";
    let energyTime = 0;
    const head = new Vector3(), lightColor = new Color();
    const probe = import.meta.env.DEV ? { time: 0, yaw: 0, pitch: 0, eyeX: 0, eyeY: 0, blink: 0, reach: 0, startle: 0 } : null;
    if (probe) (window as unknown as { __umbraProbe?: typeof probe }).__umbraProbe = probe;

    function tick(_dt: number, elapsed: number, frameDt: number) {
      if (disposed) return;
      now = elapsed;
      if (creature) story += frameDt;
      const open = reduced ? { presence: 1, materialize: 1, eyes: 1 } : opening(story);
      const awake = story >= INTRO_SECONDS;
      const motion = reduced ? 0 : 1;
      // Where is the head on screen? Nearness is measured from there.
      head.set(0, 1.5, 0).applyMatrix4(group.matrixWorld).project(rig.camera);
      const near = present && Math.hypot((cursor.x - head.x) * 1.2, cursor.y - head.y) < 0.55;
      // Speed in screen units scaled like ENTITY 001, whose temperament thresholds we reuse.
      const units = 4;
      speed = damp(speed, frameDt > 0 && present ? Math.hypot(cursor.x - previous.x, cursor.y - previous.y) * units / frameDt : 0, 6, frameDt);
      previous.x = cursor.x; previous.y = cursor.y;
      if (awake) temperament = stepTemperament(temperament, { dt: frameDt, present: present && awake, near, speed });
      const target = reactionFor(temperament.mood);
      for (const key of Object.keys(target) as (keyof Reaction)[]) reaction[key] = damp(reaction[key], target[key], 1.4, frameDt);
      const gaze = perception.step(cursor.x - head.x * 0.5, cursor.y - head.y * 0.5, present && awake, temperament.mood, frameDt);
      const laugh = laughEnvelope(elapsed - laughAt);
      const amusement = clamp(reaction.amusement + laugh);

      const weight = reaction.gaze * open.eyes;
      const yawValue = yaw.step(gaze.x * 0.5 * weight, frameDt);
      const pitchValue = pitch.step(-gaze.y * 0.3 * weight, frameDt);
      const rollValue = roll.step((clamp(-yaw.velocity * 0.08, -0.08, 0.08) + reaction.amusement * 0.08) * motion, frameDt);
      group.rotation.y = bodyYaw.step(gaze.x * 0.18 * weight, frameDt) * motion;
      creature?.update({
        dt: frameDt, time: elapsed, reduced, materialize: open.materialize,
        lookYaw: yawValue, lookPitch: pitchValue, lookRoll: rollValue,
        gazeX: (gaze.eyeX - gaze.x * 0.5 * weight), gazeY: (gaze.eyeY - gaze.y * 0.4 * weight),
        openness: open.eyes * (1 - gaze.blink * 0.95) * lerp(0.7, 1, reaction.dilation),
        reach: reaction.reach, reachX: cursor.x, reachY: cursor.y,
        startle: reaction.startle, amusement, dilation: reaction.dilation,
      });

      moon.intensity = 2.6 * open.presence;
      fill.intensity = 0.45 * open.presence;
      key.intensity = 0.55 * open.materialize;
      lightColor.set("#ff2a4a"); ember.color.copy(lightColor);
      ember.intensity = (70 + amusement * 40 + reaction.startle * 25) * open.materialize * (0.9 + 0.1 * Math.sin(elapsed * 5.3) * motion);
      backdrop.update(rig.camera, reduced ? 0 : elapsed, open.presence);
      smoke.update(reduced ? 0 : elapsed, open.presence, reaction.startle, renderer.getPixelRatio());
      rig.setPointer(gaze.x * 0.6, gaze.y * 0.6);
      rig.setExpression(-reaction.reach * 0.8 + reaction.startle * 1.2, 0, 0);
      rig.update(frameDt, elapsed, motion);
      post.bloom.strength = 0.5 + amusement * 0.15;
      post.finish.uniforms.uVignette.value = 0.55;
      post.finish.uniforms.uGrade.value = 1;
      post.finish.uniforms.uFloor.value = 0.25;
      post.finish.uniforms.uAberration.value = reduced ? 0 : 0.0007;
      post.render(frameDt, reduced ? 0 : elapsed);

      const label = !creature || !awake ? "materializando" : LABELS[temperament.mood];
      if (label !== lastLabel) { lastLabel = label; options.onState(label); }
      canvas.dataset.mood = temperament.mood;
      canvas.dataset.phase = awake ? "awake" : "intro";
      if (probe) Object.assign(probe, { time: elapsed, yaw: yawValue, pitch: pitchValue, eyeX: gaze.eyeX, eyeY: gaze.eyeY,
        blink: gaze.blink, reach: reaction.reach, startle: reaction.startle });
      if (!canvas.dataset.ready) canvas.dataset.ready = "true";
      energyTime += frameDt;
      if (energyTime > 0.15) { options.onEnergy?.(clamp(0.2 + amusement * 0.3 + reaction.startle * 0.3)); energyTime = 0; }
    }

    const loop = createFrameLoop(tick); releases.push(() => loop.dispose());
    const onContextLost = (event: Event) => { event.preventDefault(); loop.setVisible(false); options.onContextLost(); };
    canvas.addEventListener("webglcontextlost", onContextLost);
    releases.push(() => canvas.removeEventListener("webglcontextlost", onContextLost));
    const setSize = (width: number, height: number) => {
      const sizeW = Math.max(1, Math.round(width)), sizeH = Math.max(1, Math.round(height));
      const dpr = Math.min(window.devicePixelRatio || 1, options.compact ? 1.25 : 1.6, Math.sqrt(1100000 / (sizeW * sizeH)));
      renderer.setPixelRatio(dpr); renderer.setSize(sizeW, sizeH, false);
      rig.setAspect(sizeW / sizeH); post.setSize(sizeW, sizeH, dpr);
    };
    setSize(canvas.clientWidth || 1, canvas.clientHeight || 1);
    Object.assign(rig.goal, CAMERA);
    if (reduced) rig.snap();
    rig.update(0, 0, 0); loop.start();
    return {
      setSize, setVisible: loop.setVisible,
      setReduced(value) { reduced = value; if (value) { story = Math.max(story, INTRO_SECONDS); rig.snap(); } },
      pointer(x, y) { if (!present) { previous.x = x; previous.y = y; } cursor.x = x; cursor.y = y; present = true; },
      leave() { present = false; },
      tap(x, y) { cursor.x = x; cursor.y = y; present = true; if (story >= INTRO_SECONDS) laughAt = now; },
      dispose() { if (!disposed) { disposed = true; free(); scene.clear(); } },
    };
  } catch (error) { disposed = true; free(); throw error; }
}
