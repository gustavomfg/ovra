import {
  ACESFilmicToneMapping, Color, DirectionalLight, FogExp2, Group, Plane,
  PointLight, Raycaster, Scene, SpotLight, Vector2, Vector3, WebGLRenderer,
} from "three";
import { CameraRig } from "../../core/camera";
import { createFrameLoop } from "../../core/frameLoop";
import { createStudioEnvironment, disposeEnvironment, type Softbox } from "../../core/lighting";
import { clamp, damp, lerp } from "../../core/math";
import { createPostProcessing } from "../../core/postprocessing";
import { Spring } from "../../core/spring";
import { Atmosphere } from "./atmosphere";
import { Character, characterUrl } from "./character";
import { createTemperament, easeIntent, intentFor, MOOD_LABELS, stepTemperament } from "./behavior";
import { CAMERA_BASE, CAMERA_INTRO, ENTITY, MIN_CAMERA_DISTANCE, qualityFor } from "./config";
import { Dust } from "./dust";
import { createShell } from "./geometry";
import { Kernel } from "./kernel";
import { Perception } from "./perception";
import { createPerformance } from "./performance";
import { ShardSwarm } from "./shards";

export type SceneOptions = {
  canvas: HTMLCanvasElement; compact: boolean; reduced: boolean;
  onState(label: string): void; onSequence(active: boolean): void;
  onContextLost(): void; onEnergy?(value: number): void; onCue?(): void;
};
export type EntityScene = {
  setSize(width: number, height: number): void; setVisible(visible: boolean): void;
  setReduced(reduced: boolean): void; pointer(x: number, y: number): void;
  leave(): void; tap(x: number, y: number): void; hold(active: boolean): void;
  metamorphose(): boolean; dispose(): void;
};
// Reflections are drawn by long strips instead of one frontal panel: a vertical key
// strip at camera-left, a thin crown line and two cold rims behind. The face is
// lit from the side, so the ceramic reads as a volume rather than a flat blob.
const SOFTBOXES: Softbox[] = [
  { color: "#e6ded2", intensity: 2.6, position: [-9, 4, 5], size: [2.2, 11] },
  { color: "#d4dde2", intensity: 1.3, position: [-1, 10, 1.5], size: [7, 1.4] },
  { color: "#8fbad2", intensity: 2.5, position: [7, 1.5, -6], size: [1.1, 11] },
  { color: "#a9c4d4", intensity: 1.9, position: [-7, 2.5, -6.5], size: [0.9, 8] },
  { color: "#c9d3d8", intensity: 0.22, position: [3, -1, 9], size: [5, 3] },
  // Eye light: a small card ~40° off the lens axis. Its catchlight lands on the dark
  // glass beside the pupil, where a highlight reads; on the pupil it would vanish.
  { color: "#f1ece4", intensity: 5.5, position: [-6.5, 6.2, 11], size: [1.9, 1.2] },
  { color: "#daa06c", intensity: 0.3, position: [2, -7, 4], size: [4, 2] },
];

export function createEntityScene(options: SceneOptions): EntityScene {
  const { canvas } = options;
  const quality = qualityFor(options.compact);
  let reduced = options.reduced, disposed = false;
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  const releases: (() => void)[] = [() => { renderer.dispose(); if (!renderer.getContext().isContextLost()) renderer.forceContextLoss(); }];
  const free = () => releases.splice(0).reverse().forEach(release => {
    try { release(); } catch { /* Release the remaining owners even after context loss. */ }
  });
  try {
    renderer.setClearColor(ENTITY.palette.void, 1);
    renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04;
    const scene = new Scene(); scene.fog = new FogExp2(ENTITY.palette.void, 0.018);
    const environment = createStudioEnvironment(renderer, SOFTBOXES, ENTITY.palette.void);
    releases.push(() => disposeEnvironment(environment)); scene.environment = environment;
    // Side key from high camera-left. A spot, so the neck and shoulders fall into
    // the void and the skull keeps the light; two cold rims cut the silhouette.
    const key = new SpotLight("#ece9e3", 0, 60, 0.24, 1, 2); key.position.set(-12, 8, 7);
    key.target.position.set(0, 1.2, 0); scene.add(key.target);
    const rim = new DirectionalLight(ENTITY.palette.frost, 1.45); rim.position.set(6, 2.5, -6);
    const counter = new DirectionalLight("#b9cfdc", 0); counter.position.set(-6, 3, -7);
    const heart = new PointLight(ENTITY.palette.ember, 0, 5, 2);
    heart.position.set(0, ENTITY.eye.y, ENTITY.eye.z - 0.25); scene.add(key, rim, counter, heart);

    const rig = new CameraRig(reduced ? CAMERA_BASE : CAMERA_INTRO, 2.2, MIN_CAMERA_DISTANCE);
    const group = new Group(); group.rotation.order = "YXZ"; scene.add(group);
    const shell = new ShardSwarm(createShell(quality.shards, ENTITY.radius, ENTITY.aperture), ENTITY.radius);
    const kernel = new Kernel(ENTITY.radius);
    shell.mesh.visible = false; kernel.group.visible = false;
    group.add(shell.mesh, kernel.group);
    releases.push(() => shell.dispose(), () => kernel.dispose());
    const dust = new Dust(quality.dust, ENTITY.radius * 1.4, ENTITY.radius * 4.8, quality.pixelRatio);
    const atmosphere = new Atmosphere(); scene.add(dust.points, atmosphere.group);
    releases.push(() => dust.dispose(), () => atmosphere.dispose());

    let character: Character | null = null;
    let modelSettled = false, acceptModel = true, loadTime = 0;
    canvas.dataset.character = "loading";
    const activateProcedural = () => {
      if (disposed || modelSettled) return;
      modelSettled = true; acceptModel = false;
      shell.mesh.visible = true; kernel.group.visible = true;
      canvas.dataset.character = "procedural";
    };
    Character.load(characterUrl(import.meta.env.BASE_URL, options.compact)).then(loaded => {
      if (disposed || !acceptModel) { loaded.dispose(); return; }
      character = loaded; modelSettled = true; group.add(loaded.root);
      releases.push(() => loaded.dispose());
      canvas.dataset.character = "ready";
    }).catch(activateProcedural);

    const post = createPostProcessing(renderer, scene, rig.camera, 1, 1);
    releases.push(() => post.dispose());
    let temperament = createTemperament();
    let intent = intentFor("observing"), lastLabel = "";
    let breathPhase = 0, energyTime = 0, speed = 0, present = false;
    let renderScale = 1, sizeW = 1, sizeH = 1, qualityTime = 0, slowFrames = 0, qualityFrames = 0;
    const perception = new Perception();
    const yaw = new Spring(0, 14), pitch = new Spring(0, 14), roll = new Spring(0, 12);
    const lean = new Spring(0, 12), engagement = new Spring(0, 12), bodyFollow = new Spring(0.38, 12);
    const cursor = new Vector2(), previous = new Vector2();
    const raycaster = new Raycaster(), plane = new Plane();
    const facing = new Vector3(), hit = new Vector3(), local = new Vector3(), anchor = new Vector3();
    const lightColor = new Color(), ember = new Color(ENTITY.palette.ember), frost = new Color(ENTITY.palette.frost);

    const performance = createPerformance(rig.goal, reduced, {
      onPhase: phase => { canvas.dataset.phase = phase; },
      onSequence: options.onSequence, onCue: options.onCue,
    });
    releases.push(() => performance.dispose());
    canvas.dataset.phase = performance.phase;
    const director = performance.director;
    // A narrow portrait frame has no room for the halo of a full three-quarter turn.
    const restYaw = ENTITY.restYaw * (options.compact ? 0.55 : 1);
    // Development-only motion probe for the validation harness; stripped in builds.
    const probe = import.meta.env.DEV ? { time: 0, yaw: 0, pitch: 0, roll: 0, headYaw: 0, headPitch: 0,
      eyeX: 0, eyeY: 0, blink: 0, openness: 0, camX: 0, camY: 0, camZ: 0 } : null;
    if (probe) (window as unknown as { __ovraProbe?: typeof probe }).__ovraProbe = probe;
    function resolveCursor() {
      if (!present) return false;
      group.updateMatrixWorld(true); raycaster.setFromCamera(cursor, rig.camera);
      facing.copy(rig.camera.position).sub(group.position).normalize();
      anchor.set(0, ENTITY.eye.y, ENTITY.eye.z).applyMatrix4(group.matrixWorld);
      plane.setFromNormalAndCoplanarPoint(facing, anchor);
      if (!raycaster.ray.intersectPlane(plane, hit)) return false;
      local.copy(hit); group.worldToLocal(local); return true;
    }
    const isNear = () => Math.hypot(local.x / (ENTITY.radius * 0.91), local.y / (ENTITY.radius * 1.27)) < 1.18;
    function tick(_dt: number, elapsed: number, frameDt: number) {
      if (disposed) return;
      if (!modelSettled) {
        loadTime += frameDt;
        if (loadTime >= 6) activateProcedural();
      }
      // The character arrives before the opening starts; no mid-story model swap.
      if (modelSettled) performance.step(frameDt);
      const awake = performance.phase === "awake";
      director.flash *= Math.exp(-frameDt * 2.4);
      const attentive = awake && resolveCursor();
      const depth = rig.camera.position.distanceTo(group.position);
      const units = depth * Math.tan((rig.camera.fov * Math.PI) / 360);
      const moved = attentive ? cursor.distanceTo(previous) * units : 0;
      speed = damp(speed, frameDt > 0 ? moved / frameDt : 0, 6, frameDt);
      previous.copy(cursor);
      if (awake) temperament = stepTemperament(temperament, { dt: frameDt, present: attentive, near: attentive && isNear(), speed });
      intent = easeIntent(intent, intentFor(temperament.mood), frameDt);
      const gaze = perception.step(cursor.x, cursor.y, attentive, temperament.mood, frameDt);
      const motion = reduced ? 0 : 1;
      const weight = engagement.step(performance.phase === "intro" ? 0 : awake ? 1 : 0.55, frameDt);
      breathPhase += frameDt * intent.rhythm * motion;
      const breath = Math.sin(breathPhase * 1.5);
      const wander = Math.sin(elapsed * 0.12) * 0.035;
      const yawGoal = (lerp(wander, gaze.x * 0.34, intent.gaze) + intent.away * 0.38) * weight;
      // Heads travel in arcs: a fast turn dips slightly and leans into the turn.
      const turning = clamp(Math.abs(yaw.velocity) * 1.6, 0, 1);
      const pitchGoal = (intent.tilt - gaze.y * 0.11 * intent.gaze + turning * 0.035) * weight;
      const rollGoal = (intent.roll * 0.5 + clamp(-yaw.velocity * 0.05, -0.03, 0.03)) * weight;
      let headYaw = 0, headPitch = 0;
      if (reduced) {
        yaw.snap(0); pitch.snap(0); roll.snap(0); lean.snap(0); group.rotation.set(0, character ? restYaw : 0, 0);
      } else {
        const y = yaw.step(yawGoal, frameDt), p = pitch.step(pitchGoal, frameDt);
        const follow = bodyFollow.step(character ? 0.38 + intent.away * 0.32 : 1, frameDt);
        headYaw = y * (1 - follow); headPitch = p * (1 - follow);
        group.rotation.set(p * follow, (character ? restYaw : 0) + y * follow, roll.step(rollGoal, frameDt));
      }
      const leanValue = reduced ? 0 : lean.step(intent.lean * weight, frameDt);
      group.position.set(0, character ? 0 : breath * 0.014 * motion, leanValue);
      group.scale.setScalar(character ? 1 : 1 + breath * 0.003 * motion);
      const light = clamp(director.core * (0.8 + intent.light * 0.2) + director.flash * 0.2 + performance.charge * 0.06, 0, 1.08);
      const openness = reduced ? 0.85 : director.eye * intent.openness * (1 - gaze.blink * 0.92);
      // The eye leads; once the head arrives it carries part of the turn, and the
      // eye recentres in its socket.
      const eyeX = (gaze.eyeX - gaze.x * 0.55 * intent.gaze * weight) * motion;
      const eyeY = (gaze.eyeY - gaze.y * 0.45 * intent.gaze * weight) * motion;
      if (character) {
        character.update({ dt: frameDt, phase: performance.phase, storyTime: performance.time,
          mood: temperament.mood, reduced, light, warmth: intent.warmth, openness,
          lookYaw: headYaw, lookPitch: headPitch, restYaw, gazeX: eyeX, gazeY: eyeY,
          dilation: clamp(intent.dilation + (1 - light) * 0.15),
          opening: director.opening, resonance: director.resonance });
      } else if (modelSettled) {
        kernel.update({ light, warmth: intent.warmth, elapsed: reduced ? 0 : elapsed,
          openness, gazeX: eyeX, gazeY: eyeY });
        shell.update({ dt: frameDt, reveal: director.reveal, motion, glow: light,
          breath, opening: director.opening, scan: director.scan, trace: director.rim });
      }
      const label = !modelSettled || performance.phase === "intro" ? "despertando"
        : performance.phase === "sequence" ? "ressonância" : MOOD_LABELS[temperament.mood];
      if (label !== lastLabel) { lastLabel = label; options.onState(label); }
      canvas.dataset.mood = temperament.mood;
      canvas.dataset.charge = performance.charge.toFixed(2);
      canvas.dataset.storyTime = performance.time.toFixed(2);
      canvas.dataset.cameraDistance = rig.camera.position.length().toFixed(2);
      canvas.dataset.particleMode = "off";

      scene.environmentIntensity = 0.05 + director.key * 0.6;
      key.intensity = director.key * 420;
      rim.intensity = director.rim * 1.65;
      counter.intensity = director.rim * 1.1;
      lightColor.copy(frost).lerp(ember, intent.warmth); heart.color.copy(lightColor);
      heart.intensity = light * 0.5;
      dust.update(reduced ? 0 : elapsed, temperament.attention * motion, light * director.atmosphere);
      rig.setPointer(gaze.x * weight * (1 - intent.away), gaze.y * weight * (1 - intent.away));
      rig.setFocus(0, ENTITY.eye.y * 0.4, leanValue * 0.2);
      rig.setExpression(intent.camera * weight, intent.orbit * weight, intent.roll * weight * 0.012);
      rig.update(frameDt, elapsed, motion);
      atmosphere.update(rig.camera, elapsed, director.atmosphere, light, director.resonance, reduced, character ? 0 : 1);
      post.bloom.strength = 0.14 + light * 0.05 + director.resonance * 0.02;
      post.finish.uniforms.uVignette.value = 0.4;
      post.finish.uniforms.uGrade.value = 1;
      post.finish.uniforms.uFloor.value = options.compact ? 0.78 : 0.55;
      post.finish.uniforms.uAberration.value = reduced ? 0 : 0.00035;
      post.render(frameDt, reduced ? 0 : elapsed);
      if (probe) {
        Object.assign(probe, { time: elapsed, yaw: group.rotation.y, pitch: group.rotation.x, roll: group.rotation.z,
          headYaw, headPitch, eyeX, eyeY, blink: gaze.blink, openness,
          camX: rig.camera.position.x, camY: rig.camera.position.y, camZ: rig.camera.position.z });
      }
      if (!canvas.dataset.ready) canvas.dataset.ready = "true";
      qualityTime += frameDt; qualityFrames++;
      if (frameDt > 0.075) slowFrames++;
      if (qualityTime >= 3) {
        if (qualityFrames >= 10 && slowFrames / qualityFrames > 0.4 && renderScale > 0.65) {
          renderScale = Math.max(0.65, renderScale * 0.9); setSize(sizeW, sizeH);
        }
        qualityTime = 0; qualityFrames = 0; slowFrames = 0;
      }
      energyTime += frameDt;
      if (energyTime > 0.15) { options.onEnergy?.(clamp(light * 0.3 + director.resonance * 0.15)); energyTime = 0; }
    }
    const loop = createFrameLoop(tick); releases.push(() => loop.dispose());
    const onContextLost = (event: Event) => { event.preventDefault(); loop.setVisible(false); options.onContextLost(); };
    canvas.addEventListener("webglcontextlost", onContextLost);
    releases.push(() => canvas.removeEventListener("webglcontextlost", onContextLost));
    const setSize = (width: number, height: number) => {
      sizeW = Math.max(1, Math.round(width)); sizeH = Math.max(1, Math.round(height));
      const dpr = Math.min(window.devicePixelRatio || 1, quality.pixelRatio, Math.sqrt(1100000 / (sizeW * sizeH))) * renderScale;
      renderer.setPixelRatio(dpr); renderer.setSize(sizeW, sizeH, false);
      dust.setPixelRatio(dpr); rig.setAspect(sizeW / sizeH); post.setSize(sizeW, sizeH, dpr);
    };
    setSize(canvas.clientWidth || 1, canvas.clientHeight || 1);
    if (reduced) { rig.setFocus(0, ENTITY.eye.y * 0.4, 0); rig.snap(); }
    rig.update(0, 0, 0); loop.start();
    return {
      setSize, setVisible: loop.setVisible,
      setReduced(value) {
        reduced = value; performance.setReduced(value);
        if (value) { lean.snap(0); rig.setFocus(0, ENTITY.eye.y * 0.4, 0); rig.snap(); }
      },
      pointer(x, y) { if (!present) previous.set(x, y); cursor.set(x, y); present = true; },
      leave() { present = false; performance.hold(false); },
      hold(active) { performance.hold(modelSettled && active && resolveCursor() && isNear()); },
      tap(x, y) {
        cursor.set(x, y); present = true;
        if (performance.phase === "awake" && modelSettled) director.flash = Math.min(0.12, director.flash + 0.08);
      },
      metamorphose() { return modelSettled && performance.metamorphose(); },
      dispose() { if (!disposed) { disposed = true; acceptModel = false; free(); scene.clear(); } },
    };
  } catch (error) { disposed = true; free(); throw error; }
}
