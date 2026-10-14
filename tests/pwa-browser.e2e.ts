import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

const appBase = "/ovra/";
const appUrl = `http://127.0.0.1:4173${appBase}`;
const preview = spawn(process.execPath, [
  resolve("node_modules/vite/bin/vite.js"),
  "preview",
  "--host", "127.0.0.1",
  "--port", "4173",
], { stdio: "ignore" });

async function stopPreview() {
  if (preview.exitCode !== null) return;
  if (process.platform === "win32" && preview.pid) {
    spawn("taskkill", ["/pid", String(preview.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    preview.kill("SIGTERM");
  }
  await Promise.race([
    once(preview, "exit"),
    new Promise((resolve) => globalThis.setTimeout(resolve, 2_000)),
  ]);
}

test.beforeAll(async () => {
  await expect.poll(async () => {
    try {
      return (await fetch(appUrl)).ok;
    } catch {
      return false;
    }
  }, { timeout: 15_000 }).toBe(true);
});

test.afterAll(stopPreview);

test("renders UMBRA and reopens the shell offline", async ({ context, page }) => {
  await page.goto(`${appBase}#/entity-002`);
  await expect(page).toHaveTitle("OVRA — Experimental Creative Lab");
  await expect(page.getByText("OVRA", { exact: true })).toBeVisible();
  const experiment = page.getByRole("region", { name: "ENTITY 002 — UMBRA" });
  await expect(experiment).toBeVisible();

  // The first frame is drawn once WebGL2 is available; the fallback is drawn otherwise.
  await expect(page.locator("canvas.entity-canvas[data-ready='true'], canvas.entity-fallback")).toBeAttached({ timeout: 30_000 });

  const serviceWorkerScope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;

    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("Service worker did not take control.")), 10_000);
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          window.clearTimeout(timeout);
          resolve();
        }, { once: true });
      });
    }

    return registration.scope;
  });
  expect(serviceWorkerScope).toBe(`http://127.0.0.1:4173${appBase}`);

  const cachedUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      urls.push(...(await cache.keys()).map((request) => request.url));
    }
    return urls;
  });
  expect(cachedUrls.some((url) => url.endsWith("/manifest.webmanifest"))).toBe(true);
  expect(cachedUrls.some((url) => /\/assets\/index-[^/]+\.js$/.test(url))).toBe(true);
  expect(cachedUrls.some((url) => /\/assets\/Entity002-[^/]+\.js$/.test(url))).toBe(true);

  const manifest = await page.evaluate(async () => {
    const manifestUrl = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href;
    if (!manifestUrl) throw new Error("Manifest link is missing.");
    return await (await fetch(manifestUrl)).json() as { name?: string; short_name?: string };
  });
  expect(manifest).toMatchObject({ name: "OVRA", short_name: "OVRA" });

  await stopPreview();
  await page.reload();
  await expect(page.getByRole("region", { name: "ENTITY 002 — UMBRA" })).toBeVisible();

  await context.close();
});
