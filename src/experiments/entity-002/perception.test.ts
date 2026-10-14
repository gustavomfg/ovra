import { describe, expect, it } from "vitest";
import { Perception } from "./perception";

describe("Perception", () => {
  it("uses visual memory before turning toward a new cursor position", () => {
    const p = new Perception();
    for (let i = 0; i < 60; i++) p.step(0, 0, true, "observing", 1 / 60);
    const first = p.step(1, 0.4, true, "observing", 1 / 60);
    expect(first.x).toBeLessThan(0.1);
    let gaze = first;
    for (let i = 0; i < 180; i++) gaze = p.step(1, 0.4, true, "observing", 1 / 60);
    expect(gaze.x).toBeGreaterThan(0.9);
    expect(gaze.y).toBeGreaterThan(0.35);
  });
  it("ignores pursuit for an interval and bounds anticipation on re-entry", () => {
    const p = new Perception();
    let gaze = p.step(1, 1, true, "ignoring", 0.05);
    for (let i = 0; i < 100; i++) gaze = p.step(1, 1, true, "ignoring", 0.05);
    expect(gaze.x).toBeLessThan(0.4);
    expect(gaze.y).toBeLessThan(0.2);
    p.step(-1, -1, false, "observing", 0.05);
    gaze = p.step(1, 1, true, "observing", 0.001);
    expect(Number.isFinite(gaze.x)).toBe(true);
    expect(Math.abs(gaze.x)).toBeLessThanOrEqual(1);
  });
  it("leads with the eye in a fast saccade and lets the head follow", () => {
    const p = new Perception();
    for (let i = 0; i < 120; i++) p.step(0, 0, true, "observing", 1 / 60);
    let gaze = p.step(0.8, 0, true, "observing", 1 / 60);
    let led = false, eyeTime = -1, previousEye = gaze.eyeX;
    for (let i = 1; i < 120; i++) {
      gaze = p.step(0.8, 0, true, "observing", 1 / 60);
      if (gaze.eyeX - gaze.x > 0.25) led = true;
      if (eyeTime < 0 && gaze.eyeX > 0.68) eyeTime = i / 60;
      // A saccade is quick but never overshoots its target.
      expect(gaze.eyeX).toBeLessThan(0.8 + 0.05);
      expect(Math.abs(gaze.eyeX - previousEye)).toBeLessThan(0.3);
      previousEye = gaze.eyeX;
    }
    expect(led).toBe(true);
    expect(eyeTime).toBeGreaterThan(0.3);
    expect(eyeTime).toBeLessThan(0.75);
    expect(gaze.x).toBeGreaterThan(0.7);
  });
  it("blinks at a plausible, mood-dependent rate and keeps lids in range", () => {
    const count = (mood: "observing" | "alert") => {
      const p = new Perception(11);
      let blinks = 0, closed = false;
      for (let i = 0; i < 60 * 60; i++) {
        const { blink } = p.step(0.1, 0, true, mood, 1 / 60);
        expect(blink).toBeGreaterThanOrEqual(0); expect(blink).toBeLessThanOrEqual(1);
        if (blink > 0.9 && !closed) blinks++;
        closed = blink > 0.9;
      }
      return blinks;
    };
    const calm = count("observing"), alarmed = count("alert");
    expect(calm).toBeGreaterThan(7); expect(calm).toBeLessThan(24);
    expect(alarmed).toBeGreaterThan(calm);
  });
  it("is deterministic for a seed and keeps looking where the visitor left", () => {
    const run = () => {
      const p = new Perception(5); const out: number[] = [];
      for (let i = 0; i < 300; i++) out.push(p.step(Math.sin(i * 0.05), 0.2, i < 200, "observing", 1 / 60).eyeX);
      return out;
    };
    expect(run()).toEqual(run());
    const p = new Perception(5);
    let gaze = p.step(0.7, 0.2, true, "observing", 1 / 60);
    for (let i = 0; i < 180; i++) gaze = p.step(0.7, 0.2, true, "observing", 1 / 60);
    const held = gaze.x;
    for (let i = 0; i < 24; i++) gaze = p.step(0, 0, false, "observing", 1 / 60);
    expect(Math.abs(gaze.x - held)).toBeLessThan(0.08);
  });
});
