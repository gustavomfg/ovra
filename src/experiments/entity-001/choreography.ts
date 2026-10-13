import { gsap } from "gsap";
import type { CameraGoal } from "../../core/camera";
import { CAMERA_BASE } from "./config";

export type Director = {
  reveal: number; core: number; flash: number; eye: number; key: number;
  rim: number; atmosphere: number; opening: number; resonance: number; scan: number;
};
export const INTRO_DURATION = 11.8;
export const METAMORPHOSIS_DURATION = 8.8;
export function createDirector(): Director {
  return { reveal: 0, core: 0, flash: 0, eye: 0.12, key: 0, rim: 0,
    atmosphere: 0, opening: 0, resonance: 0, scan: -1 };
}
export function settleDirector(director: Director) {
  Object.assign(director, { reveal: 1, core: 1, flash: 0, eye: 1, key: 1,
    rim: 1, atmosphere: 1, opening: 0, resonance: 0, scan: 2 });
}
export function playIntro(director: Director, goal: CameraGoal, onDone: () => void) {
  return gsap.timeline({ paused: true, defaults: { ease: "sine.inOut" }, onComplete: onDone })
    .addLabel("trace", 0.3)
    .to(director, { rim: 1, atmosphere: 0.65, duration: 2 }, "trace")
    .to(director, { key: 0.18, duration: 1.8 }, 0.6)
    .to(director, { reveal: 0.38, duration: 3.2 }, 0.5)
    .to(director, { core: 0.28, duration: 1.4 }, 1.2)
    .to(director, { scan: 1.4, duration: 6.8, ease: "none" }, 0.6)
    .to(goal, { distance: CAMERA_BASE.distance * 1.09, orbit: -0.02, height: 0.055, fov: CAMERA_BASE.fov + 1, duration: 6.4 }, 0)
    .addLabel("material", 3.4)
    .to(director, { reveal: 1, key: 0.8, duration: 4.6 }, "material")
    .to(director, { core: 0.75, eye: 0.38, duration: 3.5 }, 4.3)
    .addLabel("recognition", 8)
    .to(director, { core: 1, eye: 1, rim: 1, key: 1, atmosphere: 1, duration: 3.8 }, "recognition")
    .to(goal, { ...CAMERA_BASE, duration: 5.4 }, 6.4);
}

// The capsule stays assembled. A small plate opening, a restrained light pulse
// and one slow camera arc form the event; no particles, scatter or core dive.
export function playMetamorphosis(director: Director, goal: CameraGoal, reduced: boolean, onDone: () => void, onCue?: () => void) {
  const timeline = gsap.timeline({ paused: true, defaults: { ease: "sine.inOut" }, onComplete: onDone });
  if (reduced) return timeline.to(director, { flash: 0.12, duration: 0.8 })
    .to(director, { flash: 0, duration: 1.6 });
  return timeline
    .addLabel("anticipation", 0)
    .to(director, { opening: -0.02, eye: 0.86, key: 0.94, core: 0.96, duration: 1.8 }, 0)
    .to(goal, { distance: CAMERA_BASE.distance * 1.034, orbit: CAMERA_BASE.orbit + 0.035, duration: 2.2 }, 0)
    .addLabel("resonance", 1.8)
    .call(() => onCue?.(), [], "resonance")
    .to(director, { opening: 0.14, eye: 1, core: 1.08, resonance: 1, rim: 1.06, duration: 3 }, "resonance")
    .to(goal, { distance: CAMERA_BASE.distance * 0.97, orbit: CAMERA_BASE.orbit - 0.07, height: 0.045, duration: 3.6 }, "resonance")
    .addLabel("quiet", 4.8)
    .addLabel("return", 5.8)
    .to(director, { opening: 0, core: 1, eye: 1, key: 1, rim: 1, resonance: 0, duration: 3 }, "return")
    .to(goal, { ...CAMERA_BASE, duration: 3 }, "return");
}
