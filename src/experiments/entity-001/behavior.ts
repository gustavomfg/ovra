import { clamp, damp } from "../../core/math";

export type Mood = "dreaming" | "observing" | "curious" | "wary" | "ignoring" | "alert" | "disturbed";

export const TIMING = {
  near: 0.95, fast: 6, calm: 0.65, linger: 2.3,
  wary: 1.35, ignore: 4.8, idle: 9,
  alert: 2.2, disturbed: 2.8,
};

export type Temperament = {
  mood: Mood; timer: number; lingering: number; ignoreLeft: number;
  idle: number; attention: number; stress: number; still: number;
};
export type Sense = { dt: number; present: boolean; near: boolean; speed: number; contact?: boolean };

export function createTemperament(): Temperament {
  return { mood: "observing", timer: 0, lingering: 0, ignoreLeft: 0, idle: 0, attention: 0, stress: 0, still: 0 };
}

// Stress is memory, not a switch: repeated intrusions escalate, and calm restores trust.
// Minimum dwell times keep a gesture from flickering through several moods in one second.
export function stepTemperament(state: Temperament, sense: Sense): Temperament {
  const dt = clamp(sense.dt, 0, 0.25);
  const rushing = sense.present && sense.near && sense.speed > TIMING.fast;
  const calm = sense.present && sense.near && sense.speed < TIMING.calm;
  const idle = sense.present ? 0 : state.idle + dt;
  const still = calm ? state.still + dt : Math.max(0, state.still - dt * 2);
  const stress = clamp(state.stress + (rushing ? 1.7 : sense.contact ? 2.8 : -0.24) * dt, 0, 4);
  const attention = damp(state.attention, calm ? 1 : sense.present ? 0.4 : 0, calm ? 0.65 : 0.25, dt);
  let { mood, timer, lingering, ignoreLeft } = state;
  timer += dt;
  const become = (next: Mood) => {
    if (next !== mood) { mood = next; timer = 0; }
  };

  if (mood === "ignoring") {
    ignoreLeft = Math.max(0, ignoreLeft - dt);
    lingering = 0;
    if (ignoreLeft === 0) become(idle >= TIMING.idle ? "dreaming" : "observing");
  } else if (mood === "disturbed") {
    if (timer >= TIMING.disturbed) { ignoreLeft = TIMING.ignore + 1.8; become("ignoring"); }
  } else if (mood === "alert") {
    if (stress > 2.6) become("disturbed");
    else if (timer >= TIMING.alert && !rushing) { ignoreLeft = TIMING.ignore * 0.7; become("ignoring"); }
  } else if (mood === "wary") {
    if (stress > 1.45) become("alert");
    else if (timer >= TIMING.wary) { ignoreLeft = TIMING.ignore; become("ignoring"); }
  } else {
    if (rushing || sense.contact) {
      lingering = 0;
      become(stress > 2.6 ? "disturbed" : stress > 1.45 ? "alert" : "wary");
    } else if (calm) {
      lingering += dt;
      if (lingering >= TIMING.linger) become("curious");
      else if (mood === "dreaming") become("observing");
    } else {
      lingering = Math.max(0, lingering - dt * 2);
      if (mood === "curious" && lingering === 0) become("observing");
      if (mood === "dreaming" && sense.present) become("observing");
    }
    if (!sense.present && idle >= TIMING.idle) become("dreaming");
  }
  return { mood, timer, lingering, ignoreLeft, idle, attention, stress, still };
}

export type Intent = {
  gaze: number; lean: number; light: number; warmth: number; away: number;
  openness: number; rhythm: number; tilt: number; roll: number; camera: number; orbit: number;
  // Pupil dilation 0..1: wide in curiosity and reverie, narrow in alarm.
  dilation: number;
};

// States differ in attention and posture; alarm never introduces vibration or
// particle forces. Aversion is a continuous weight, not a switch in the body rig.
const INTENTS: Record<Mood, Intent> = {
  dreaming:  { gaze: 0, lean: -0.04, light: 0.46, warmth: 0.85, away: 0, openness: 0.46, rhythm: 0.55, tilt: 0.035, roll: -0.012, camera: 0.25, orbit: 0.025, dilation: 0.78 },
  observing: { gaze: 0.62, lean: 0, light: 0.76, warmth: 1, away: 0, openness: 0.82, rhythm: 0.65, tilt: 0, roll: 0, camera: 0, orbit: 0, dilation: 0.55 },
  curious:   { gaze: 0.86, lean: 0.12, light: 0.9, warmth: 1, away: 0, openness: 1, rhythm: 0.62, tilt: -0.035, roll: 0.025, camera: -0.3, orbit: -0.045, dilation: 0.92 },
  wary:      { gaze: 0.65, lean: -0.18, light: 0.8, warmth: 0.7, away: 0, openness: 0.66, rhythm: 0.74, tilt: 0.04, roll: -0.02, camera: 0.28, orbit: 0.035, dilation: 0.3 },
  ignoring:  { gaze: 0.12, lean: -0.07, light: 0.5, warmth: 0.55, away: 1, openness: 0.55, rhythm: 0.58, tilt: 0.025, roll: 0.025, camera: 0.3, orbit: 0.04, dilation: 0.42 },
  alert:     { gaze: 0.8, lean: -0.14, light: 0.87, warmth: 0.45, away: 0, openness: 0.72, rhythm: 0.8, tilt: -0.02, roll: -0.025, camera: 0.3, orbit: -0.04, dilation: 0.14 },
  disturbed: { gaze: 0.35, lean: -0.22, light: 0.72, warmth: 0.4, away: 0.35, openness: 0.6, rhythm: 0.84, tilt: 0.055, roll: 0.025, camera: 0.4, orbit: 0.04, dilation: 0.22 },
};
export function intentFor(mood: Mood): Intent { return { ...INTENTS[mood] }; }
export function easeIntent(current: Intent, target: Intent, dt: number): Intent {
  const next = { ...target };
  for (const key of Object.keys(target) as (keyof Intent)[]) next[key] = damp(current[key], target[key], 1.15, dt);
  return next;
}
export const MOOD_LABELS: Record<Mood, string> = {
  dreaming: "sonhando", observing: "observando", curious: "curiosa",
  wary: "recuando", ignoring: "indiferente", alert: "alerta", disturbed: "perturbada",
};
