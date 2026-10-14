// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
  window.location.hash = "#/entity-002";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("OVRA shell", () => {
  it("shows the wordmark and a discreet experiment index", () => {
    render(<App />);
    expect(screen.getByText("OVRA")).toBeTruthy();
    const index = screen.getByRole("navigation", { name: "Experimentos" });
    expect(index.textContent).toBe("002");
  });

  it("loads the requested experiment lazily", async () => {
    render(<App />);
    expect(await screen.findByRole("region", { name: "ENTITY 002 — UMBRA" })).toBeTruthy();
  });
  it("opens UMBRA for a retired or unknown URL", async () => {
    window.location.hash = "#/entity-001";
    render(<App />);
    expect(await screen.findByRole("region", { name: "ENTITY 002 — UMBRA" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /, experimento/ })).toHaveLength(1);
  });
});
