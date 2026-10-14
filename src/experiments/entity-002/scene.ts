import {
  ACESFilmicToneMapping, DirectionalLight, FogExp2, Group, PCFShadowMap, PointLight, Scene, Vector3, WebGLRenderer,
} from "three";
import { CameraRig, type CameraGoal } from "../../core/camera";
import { createFrameLoop } from "../../core/frameLoop";
import { createStudioEnvironment, disposeEnvironment, type Softbox } from "../../core/lighting";
import { clamp, damp, lerp, smoothstep } from "../../core/math";
import { createPostProcessing } from "../../core/postprocessing";
import { Spring } from "../../core/spring";
import { createTemperament, stepTemperament } from "./behavior";
import { Perception } from "./perception";
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

const VOID = "#040305";
// The crown, face and hands stay readable together, with a small low-angle view.
export const CAMERA: CameraGoal = { distance: 20.8, orbit: .085, height: -.025, fov: 34 };
const CAMERA_OPENING: CameraGoal = { distance: 24, orbit: -.12, height: -.055, fov: 35 };
const SOFTBOXES: Softbox[] = [
  { color: "#d4cddd", intensity: 3, position: [6, 9, -7], size: [2, 10] },
  { color: "#a596b5", intensity: 2, position: [-8, 5, 6], size: [4, 8] },
  { color: "#b64972", intensity: .4, position: [1, -5, 4], size: [6, 2] },
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
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
    const scene = new Scene();
    scene.fog = new FogExp2(VOID, .008);
    const environment = createStudioEnvironment(renderer, SOFTBOXES, VOID);
    releases.push(() => disposeEnvironment(environment));
    scene.environment = environment; scene.environmentIntensity = .55;
    const moon = new DirectionalLight("#cdc5dd", 0); moon.position.set(5, 7, -5);
    const fill = new DirectionalLight("#a492b9", 0); fill.position.set(-7, 2, 6);
    const ember = new PointLight("#e53b71", 0, 16, 2); ember.position.set(.3, -1, 4.5);
    const key = new DirectionalLight("#ded1de", 0); key.position.set(-5, 7, 8);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(options.compact ? 512 : 1024);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 7, bottom: -6, near: .5, far: 35 });
    key.shadow.bias = -.0005; key.shadow.normalBias = .025;
    releases.push(() => key.shadow.dispose());
    scene.add(moon, fill, ember, key);

    const framingScale = options.compact ? 1.15 : 1;
    const restFraming = { ...CAMERA, distance: CAMERA.distance * framingScale };
    const openingFraming = { ...CAMERA_OPENING, distance: CAMERA_OPENING.distance * framingScale };
    const rig = new CameraRig(reduced ? restFraming : openingFraming, 1.4, 18.5);
    rig.setFocus(0, 1.1, 0);
    const group = new Group(); group.rotation.order = "YXZ"; scene.add(group);
    const smoke = new Smoke(options.compact ? 14 : 28); scene.add(smoke.group);
    releases.push(() => smoke.dispose());

    let creature: Creature | null = null;
    canvas.dataset.character = "loading";
    Creature.load(creatureUrl(import.meta.env.BASE_URL, options.compact)).then(loaded => {
      if (disposed) { loaded.dispose(); return; }
      creature = loaded; group.add(loaded.root); releases.push(() => loaded.dispose());
      canvas.dataset.character = "ready";
    }).catch(() => { if (!disposed) { canvas.dataset.character = "failed"; options.onContextLost(); } });

    const post = createPostProcessing(renderer, scene, rig.camera, 1, 1);
    releases.push(() => post.dispose());
    post.bloom.threshold = 1.05; post.bloom.radius = .35;

    let temperament = createTemperament();
    const reaction: Reaction = reactionFor("observing");
    const perception = new Perception(0x0b2a);
    const yaw = new Spring(0, 10), pitch = new Spring(0, 10), roll = new Spring(0, 8), bodyYaw = new Spring(0, 4);
    const cursor = { x: 0, y: 0 }, previous = { x: 0, y: 0 };
    let present = false, speed = 0, story = reduced ? INTRO_SECONDS : 0, laughAt = -10, now = 0, lastLabel = "";
    let energyTime = 0, loadingTime = 0;
    const head = new Vector3();
    const probe = import.meta.env.DEV ? { time: 0, yaw: 0, pitch: 0, eyeX: 0, eyeY: 0, blink: 0, reach: 0, startle: 0 } : null;
    if (probe) (window as unknown as { __umbraProbe?: typeof probe }).__umbraProbe = probe;

    function tick(_dt: number, elapsed: number, frameDt: number) {
      if (disposed) return;
      now = elapsed;
      if (!creature) {
        loadingTime += frameDt;
        if (loadingTime >= 8) { loop.setVisible(false); options.onContextLost(); return; }
      }
      if (creature) story += frameDt;
      const open = reduced ? { presence: 1, materialize: 1, eyes: 1 } : opening(story);
      const awake = story >= INTRO_SECONDS;
      const motion = reduced ? 0 : 1;
      const framing = reduced ? 1 : smoothstep(0, 8.8, story);
      for (const channel of ["distance", "orbit", "height", "fov"] as const) {
        rig.goal[channel] = lerp(openingFraming[channel], restFraming[channel], framing);
      }
      // Where is the head on screen? Nearness is measured from there.
      group.updateMatrixWorld();
      head.set(0, 2.08, 0).applyMatrix4(group.matrixWorld).project(rig.camera);
      const near = present && Math.hypot((cursor.x - head.x) * 1.2, cursor.y - head.y) < 0.55;
      // Normalize screen speed to the temperament thresholds.
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
      const yawValue = yaw.step(gaze.x * .32 * weight, frameDt);
      const pitchValue = pitch.step(-gaze.y * .20 * weight, frameDt);
      const rollValue = roll.step((clamp(-yaw.velocity * 0.08, -0.08, 0.08) + reaction.amusement * 0.08) * motion, frameDt);
      group.rotation.y = -.08 + bodyYaw.step(gaze.x * .14 * weight, frameDt) * motion;
      creature?.update({
        dt: frameDt, time: elapsed, reduced, materialize: open.materialize, eyePresence: open.eyes,
        lookYaw: yawValue, lookPitch: pitchValue, lookRoll: rollValue,
        gazeX: (gaze.eyeX - gaze.x * 0.5 * weight), gazeY: (gaze.eyeY - gaze.y * 0.4 * weight),
        openness: reduced ? 1 : open.eyes * (1 - gaze.blink * .95) * lerp(.85, 1, reaction.dilation),
        reach: reaction.reach, reachX: cursor.x, reachY: cursor.y,
        startle: reaction.startle, amusement, dilation: reaction.dilation,
      });

      moon.intensity = 2.4 * open.presence;
      fill.intensity = .42 * open.presence;
      key.intensity = 1.95 * open.materialize;
      ember.intensity = (8 + amusement * 5) * open.materialize;
      smoke.update(reduced ? 0 : elapsed, open.presence, reaction.startle * .3);
      rig.setPointer(gaze.x * 0.6, gaze.y * 0.6);
      rig.setExpression(-reaction.reach * .35 + reaction.startle * .5, 0, 0);
      rig.update(frameDt, elapsed, motion);
      post.bloom.strength = .22 + amusement * .045;
      post.finish.uniforms.uVignette.value = .4;
      post.finish.uniforms.uGrade.value = .55;
      post.finish.uniforms.uFloor.value = .08;
      post.finish.uniforms.uAberration.value = 0;
      post.render(frameDt, reduced ? 0 : elapsed);

      const label = !creature || !awake ? "materializando" : LABELS[temperament.mood];
      if (label !== lastLabel) { lastLabel = label; options.onState(label); }
      canvas.dataset.mood = temperament.mood;
      canvas.dataset.phase = awake ? "awake" : "intro";
      canvas.dataset.storyTime = story.toFixed(3);
      canvas.dataset.cameraDistance = rig.camera.position.length().toFixed(2);
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
      const dpr = Math.min(window.devicePixelRatio || 1, options.compact ? 1.25 : 1.6, Math.sqrt(1500000 / (sizeW * sizeH)));
      renderer.setPixelRatio(dpr); renderer.setSize(sizeW, sizeH, false);
      rig.setAspect(sizeW / sizeH); post.setSize(sizeW, sizeH, dpr);
    };
    setSize(canvas.clientWidth || 1, canvas.clientHeight || 1);
    if (reduced) rig.snap();
    rig.update(0, 0, 0); loop.start();
    return {
      setSize, setVisible: loop.setVisible,
      setReduced(value) { reduced = value; if (value) { story = Math.max(story, INTRO_SECONDS); Object.assign(rig.goal, restFraming); rig.snap(); } },
      pointer(x, y) { if (!present) { previous.x = x; previous.y = y; } cursor.x = x; cursor.y = y; present = true; },
      leave() { present = false; },
      tap(x, y) { cursor.x = x; cursor.y = y; present = true; if (story >= INTRO_SECONDS && now - laughAt > 3.5) laughAt = now; },
      dispose() { if (!disposed) { disposed = true; free(); scene.clear(); if (probe) delete (window as unknown as { __umbraProbe?: unknown }).__umbraProbe; } },
    };
  } catch (error) { disposed = true; free(); throw error; }
}
