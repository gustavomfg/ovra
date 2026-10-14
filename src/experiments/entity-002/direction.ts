import { smoothstep } from "../../core/math";
import type { Mood } from "./behavior";

// Pure timing and reaction rules for UMBRA, kept free of three.js for tests.

export const INTRO_SECONDS = 9.2;

export type Opening = { presence: number; materialize: number; eyes: number };
// A glance in the void, then the rim reveals the crown and the heavier matter.
export function opening(time: number): Opening {
  return {
    presence: smoothstep(.8, 5.2, time),
    materialize: smoothstep(2.6, 8.4, time),
    eyes: smoothstep(1.2, 3.2, time),
  };
}

export const LABELS: Record<Mood, string> = {
  dreaming: "à espreita", observing: "observando", curious: "intrigada",
  wary: "recuando", ignoring: "desdenhosa", alert: "eriçada", disturbed: "furiosa",
};

export type Reaction = { reach: number; startle: number; amusement: number; dilation: number; gaze: number };
// Each temperament reads in the body: curiosity reaches out, alarm flinches and
// spreads the tatters, disdain looks away with a smirk.
const REACTIONS: Record<Mood, Reaction> = {
  dreaming: { reach: 0, startle: 0, amusement: 0.05, dilation: 0.75, gaze: 0.15 },
  observing: { reach: 0, startle: 0, amusement: 0.2, dilation: 0.5, gaze: 0.8 },
  curious: { reach: 1, startle: 0, amusement: 0.45, dilation: 0.95, gaze: 1 },
  wary: { reach: 0, startle: 0.45, amusement: 0, dilation: 0.25, gaze: 0.8 },
  ignoring: { reach: 0, startle: 0, amusement: 0.35, dilation: 0.4, gaze: 0.2 },
  alert: { reach: 0, startle: 0.85, amusement: 0, dilation: 0.05, gaze: 1 },
  disturbed: { reach: 0, startle: 1, amusement: 0, dilation: 0.1, gaze: 0.6 },
};
export function reactionFor(mood: Mood): Reaction { return { ...REACTIONS[mood] }; }

// A tap or the keyboard control provokes a slow, deliberate response.
export function laughEnvelope(since: number) {
  if (since < 0) return 0;
  return smoothstep(0, .65, since) * Math.exp(-Math.max(0, since - .85) * .9);
}
