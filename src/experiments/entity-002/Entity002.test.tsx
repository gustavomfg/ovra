// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Entity002 from "./Entity002";
import { creatureUrl } from "./creature";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Entity002", () => {
  it("falls back to the essential drawing without WebGL2 and keeps the sound control", () => {
    render(<Entity002 />);
    expect(screen.getByRole("region", { name: "ENTITY 002 — UMBRA" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Criatura de sombra/ })).toBeTruthy();
    expect(screen.getByText("modo essencial", { exact: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ativar som" })).toBeTruthy();
  });
  it("chooses the asset by device class under the Pages base path", () => {
    expect(creatureUrl("/ovra/", false)).toBe("/ovra/3d/entity-002/umbra-cinematic.glb");
    expect(creatureUrl("/ovra/", true)).toBe("/ovra/3d/entity-002/umbra-optimized.glb");
  });
});
