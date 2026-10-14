import { describe, expect, it } from "vitest";
import { hashForSlug, slugFromHash } from "./routing";
import { experiments, findExperiment } from "../experiments/registry";

describe("routing", () => {
  it("reads the experiment slug from the hash in both forms", () => {
    expect(slugFromHash("#/entity-002")).toBe("entity-002");
    expect(slugFromHash("#entity-002")).toBe("entity-002");
    expect(slugFromHash("")).toBe("");
  });

  it("builds hashes that round-trip", () => {
    expect(slugFromHash(hashForSlug("entity-002"))).toBe("entity-002");
  });
});

describe("experiment registry", () => {
  it("opens only UMBRA and retires the previous experiment", () => {
    expect(experiments.map(item => item.slug)).toEqual(["entity-002"]);
    expect(findExperiment("entity-001")).toBeUndefined();
  });
  it("has unique slugs and index codes, and resolves each slug", () => {
    const slugs = experiments.map((item) => item.slug);
    const codes = experiments.map((item) => item.code);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(codes).size).toBe(codes.length);
    for (const item of experiments) expect(findExperiment(item.slug)).toBe(item);
  });
});
