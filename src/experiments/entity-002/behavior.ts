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

