import { describe, expect, it } from "vitest";
import { INTRO_SECONDS, LABELS, laughEnvelope, opening, reactionFor } from "./direction";

describe("UMBRA direction", () => {
  it("reveals the gaze before the heavier matter", () => {
    expect(opening(0)).toEqual({ presence: 0, materialize: 0, eyes: 0 });
    const early = opening(2);
    expect(early.presence).toBeGreaterThan(early.materialize);
    expect(early.eyes).toBeGreaterThan(early.materialize);
    const late = opening(INTRO_SECONDS);
    expect(late.presence).toBe(1); expect(late.materialize).toBe(1); expect(late.eyes).toBe(1);
  });
  it("reads each temperament in the body and labels every mood", () => {
    expect(reactionFor("curious").reach).toBe(1);
    expect(reactionFor("alert").startle).toBeGreaterThan(reactionFor("wary").startle);
    expect(reactionFor("alert").dilation).toBeLessThan(reactionFor("curious").dilation);
    for (const mood of ["dreaming", "observing", "curious", "wary", "ignoring", "alert", "disturbed"] as const) {
      expect(LABELS[mood]).toBeTruthy();
    }
    const copy = reactionFor("curious"); copy.reach = 0;
    expect(reactionFor("curious").reach).toBe(1);
  });
  it("responds with anticipation and a long, bounded fade", () => {
    expect(laughEnvelope(-1)).toBe(0);
    expect(laughEnvelope(0.85)).toBeCloseTo(1, 5);
    expect(laughEnvelope(2)).toBeLessThan(laughEnvelope(.85));
    expect(laughEnvelope(8)).toBeLessThan(0.01);
  });
});
