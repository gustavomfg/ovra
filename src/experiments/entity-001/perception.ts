import { clamp, createRandom, damp, lerp, smoothstep } from "../../core/math";
import { Spring } from "../../core/spring";
import type { Mood } from "./behavior";

type Sample = { time: number; x: number; y: number };
// x, y: where attention rests (the head follows it). eyeX, eyeY: where the eye
// points, which jumps ahead in saccades. blink: lid closure 0..1.
export type Gaze = { x: number; y: number; blink: number; eyeX: number; eyeY: number };

type Blink = { close: number; hold: number; open: number };
const BLINK_FAST: Blink = { close: 0.075, hold: 0.035, open: 0.17 };
const BLINK_SLOW: Blink = { close: 0.2, hold: 0.14, open: 0.42 };
// Seconds between spontaneous blinks. A curious stare blinks least, alarm most.
const BLINK_INTERVAL: Record<Mood, [number, number]> = {
  dreaming: [2.6, 5.2], observing: [3.2, 6.4], curious: [4.6, 8.2], wary: [1.9, 3.6],
  ignoring: [3, 6], alert: [1.6, 3.1], disturbed: [1.8, 3.4],
};

// Minimum-jerk profile: zero velocity and acceleration at both ends, so a jump is
// fast without a visible snap or settle.
const minJerk = (t: number) => t * t * t * (10 + t * (-15 + t * 6));

// Eye-head coordination instead of a lookAt. The eye fixates, then jumps to a new
// target in a short saccade (30–120 ms, with a small undershoot that a corrective
// saccade fixes), pursues slow motion smoothly and drifts in microsaccades. The
// head follows the fixation, not the cursor, so the eye always leads. Large gaze
// shifts carry a blink, as in people and animals. Idle attention rests on chosen
// points and holds them; when the visitor leaves, the eye keeps the last place.
export class Perception {
  private readonly random: () => number;
  private readonly samples: Sample[] = [];
  private readonly x = new Spring(0, 30);
  private readonly y = new Spring(0, 26);
  private time = 0;
  private lastX = 0;
  private lastY = 0;
  private vx = 0;
  private vy = 0;
  private present = false;
  private mood: Mood = "observing";
  private hesitation = 0;
  private attention = 0;
  private seenX = 0;
  private seenY = 0;
  private lost = 10;
  // Idle attention.
  private restX = 0;
  private restY = 0;
  private restTimer = 1.5;
  // Fixation and the saccade in flight.
  private fixX = 0;
  private fixY = 0;
  private fromX = 0;
  private fromY = 0;
  private progress = 1;
  private duration = 0.05;
  private sinceSaccade = 1;
  // Microsaccades: a tiny offset with its own jump.
  private microX = 0;
  private microY = 0;
  private microFromX = 0;
  private microFromY = 0;
  private microToX = 0;
  private microToY = 0;
  private microProgress = 1;
  private microTimer = 0.8;
  // Blinks.
  private blinkTime = -1;
  private blinkShape = BLINK_FAST;
  private blinkTimer = 2.4;
  private sinceBlink = 5;
  private doubleBlink = false;

  constructor(seed = 0x0e17) { this.random = createRandom(seed); }

  private range(min: number, max: number) { return min + (max - min) * this.random(); }

  step(x: number, y: number, present: boolean, mood: Mood, dt: number): Gaze {
    x = clamp(x, -1, 1); y = clamp(y, -1, 1);
    dt = clamp(dt, 0, 0.25);
    this.time += dt;
    if (present && !this.present) {
      this.lastX = x; this.lastY = y; this.samples.length = 0; this.vx = 0; this.vy = 0;
    }
    this.lost = present ? 0 : this.lost + dt;
    this.present = present;
    if (mood !== this.mood) { this.hesitation = 0.3; this.mood = mood; }
    this.hesitation = Math.max(0, this.hesitation - dt);
    this.vx = damp(this.vx, dt > 0 ? clamp((x - this.lastX) / dt, -5, 5) : 0, 4, dt);
    this.vy = damp(this.vy, dt > 0 ? clamp((y - this.lastY) / dt, -5, 5) : 0, 4, dt);
    this.lastX = x; this.lastY = y;

    // Visual memory: attention reacts to where the cursor was a moment ago, plus
    // a bounded guess of where it is heading.
    this.samples.push({ time: this.time, x, y });
    const memoryTime = this.time - (mood === "curious" ? 0.24 : 0.32);
    while (this.samples.length > 2 && this.samples[1].time <= memoryTime) this.samples.shift();
    const before = this.samples[0], after = this.samples[1] ?? before;
    const blend = after.time > before.time ? clamp((memoryTime - before.time) / (after.time - before.time)) : 0;
    const attentive = present && mood !== "ignoring" && mood !== "dreaming";
    this.attention = damp(this.attention, attentive ? 1 - this.hesitation * 1.2 : 0, 3, dt);
    const predictedX = lerp(before.x, after.x, blend) + clamp(this.vx * 0.018, -0.025, 0.025);
    const predictedY = lerp(before.y, after.y, blend) + clamp(this.vy * 0.014, -0.02, 0.02);
    if (present) { this.seenX = predictedX; this.seenY = predictedY; }

    // Where attention rests without a visitor: a few chosen points, each held.
    this.restTimer -= dt;
    if (this.restTimer <= 0) {
      const dreaming = mood === "dreaming";
      const centre = this.random() < 0.35;
      this.restX = centre ? 0 : this.range(-1, 1) * (dreaming ? 0.12 : 0.3);
      this.restY = centre ? 0 : this.range(-1, 1) * (dreaming ? 0.05 : 0.12);
      this.restTimer = dreaming ? this.range(3, 6) : this.range(1.6, 4.2);
    }
    // Just after the visitor leaves, keep looking where they were.
    const linger = present ? 0 : 1 - smoothstep(0.5, 1.1, this.lost);
    const idleX = lerp(this.restX, this.seenX, linger), idleY = lerp(this.restY, this.seenY, linger);
    const targetX = lerp(idleX, predictedX, this.attention);
    const targetY = lerp(idleY, predictedY, this.attention);

    this.saccades(targetX, targetY, mood, dt);
    this.blinks(mood, dt);

    const progress = minJerk(this.progress);
    const eyeX = lerp(this.fromX, this.fixX, progress) + this.microX;
    const eyeY = lerp(this.fromY, this.fixY, progress) + this.microY;
    return {
      x: clamp(this.x.step(this.fixX, dt), -1, 1), y: clamp(this.y.step(this.fixY, dt), -1, 1),
      eyeX: clamp(eyeX, -1, 1), eyeY: clamp(eyeY, -1, 1), blink: this.blinkValue(),
    };
  }

  private saccades(targetX: number, targetY: number, mood: Mood, dt: number) {
    this.sinceSaccade += dt;
    if (this.progress < 1) this.progress = Math.min(1, this.progress + dt / this.duration);
    // Smooth pursuit for a target the eye is already on; saccades handle the rest.
    if (this.progress >= 1 && mood !== "dreaming") {
      const gain = 6.5 * this.attention;
      this.fixX = damp(this.fixX, targetX, gain, dt); this.fixY = damp(this.fixY, targetY, gain, dt);
      this.fromX = this.fixX; this.fromY = this.fixY;
    }
    const errorX = targetX - this.fixX, errorY = (targetY - this.fixY) * 1.6;
    const error = Math.hypot(errorX, errorY);
    const threshold = mood === "dreaming" ? 0.12 : mood === "alert" || mood === "wary" ? 0.045 : 0.065;
    if (this.progress >= 1 && this.sinceSaccade > 0.16 && error > threshold) {
      const amplitude = Math.hypot(targetX - this.fixX, targetY - this.fixY);
      // Primary saccades land a little short; the remaining error triggers a
      // corrective one if it is still large enough to notice.
      const reach = amplitude > 0.25 ? 0.93 : 1;
      this.fromX = this.fixX; this.fromY = this.fixY;
      this.fixX += (targetX - this.fixX) * reach; this.fixY += (targetY - this.fixY) * reach;
      this.progress = 0; this.sinceSaccade = 0;
      this.duration = 0.03 + 0.05 * Math.min(1.8, amplitude);
      this.microToX = 0; this.microToY = 0; this.microFromX = this.microX; this.microFromY = this.microY; this.microProgress = 0;
      if (amplitude > 0.5 && this.sinceBlink > 1.2 && this.random() < 0.7) this.startBlink(mood);
    }
    // Microsaccades keep a fixating eye alive without visible wander.
    this.microTimer -= dt;
    if (this.progress >= 1 && this.microTimer <= 0) {
      const angle = this.random() * Math.PI * 2, size = this.range(0.012, mood === "dreaming" ? 0.018 : 0.032);
      this.microFromX = this.microX; this.microFromY = this.microY;
      this.microToX = Math.cos(angle) * size; this.microToY = Math.sin(angle) * size * 0.6;
      this.microProgress = 0;
      this.microTimer = mood === "dreaming" ? this.range(1.5, 3) : this.range(0.6, 1.8);
    }
    if (this.microProgress < 1) {
      this.microProgress = Math.min(1, this.microProgress + dt / 0.035);
      const t = minJerk(this.microProgress);
      this.microX = lerp(this.microFromX, this.microToX, t); this.microY = lerp(this.microFromY, this.microToY, t);
    }
  }

  private startBlink(mood: Mood) {
    if (this.blinkTime >= 0) return;
    this.blinkTime = 0; this.sinceBlink = 0;
    this.blinkShape = mood === "dreaming" ? BLINK_SLOW : BLINK_FAST;
    const [min, max] = BLINK_INTERVAL[mood];
    this.blinkTimer = this.range(min, max);
  }

  private blinks(mood: Mood, dt: number) {
    this.sinceBlink += dt;
    if (this.blinkTime >= 0) {
      this.blinkTime += dt;
      const { close, hold, open } = this.blinkShape;
      if (this.blinkTime >= close + hold + open) {
        this.blinkTime = -1;
        // Now and then a second blink follows at once.
        if (!this.doubleBlink && this.random() < 0.12) { this.doubleBlink = true; this.blinkTimer = 0.09; }
        else this.doubleBlink = false;
      }
      return;
    }
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) this.startBlink(mood);
  }

  private blinkValue() {
    if (this.blinkTime < 0) return 0;
    const { close, hold, open } = this.blinkShape, t = this.blinkTime;
    if (t < close) { const k = t / close; return k * k; }
    if (t < close + hold) return 1;
    const k = clamp((t - close - hold) / open);
    return 1 - k * (2 - k);
  }
}
