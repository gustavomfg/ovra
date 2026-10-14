// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

import { injectPrecacheManifest } from "../vite.config.ts";

type ServiceWorkerEvent = {
  request?: { method: string; mode: string; url: string };
  waitUntil: (promise: Promise<unknown>) => void;
  respondWith?: (promise: Promise<Response>) => void;
};

describe("PWA offline shell", () => {
  it("reopens the shell and experiment chunks offline after the first install", async () => {
    const scope = "https://example.test/ovra/";
    const urls = ["./", "./index.html", "./assets/index-deadbeef.js", "./assets/Entity002-cafe.js"];
    const source = injectPrecacheManifest(
      readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
      "test-build",
      urls,
    );
    const listeners = new Map<string, (event: ServiceWorkerEvent) => void>();
    const stores = new Map<string, Map<string, Response>>();
    let online = true;

    const normalize = (request: string | { url: string }) => new URL(
      typeof request === "string" ? request : request.url,
      scope,
    ).href;
    const fetchMock = vi.fn(async (request: string | { url: string }) => {
      if (!online) throw new Error("offline");
      return new Response(`network:${normalize(request)}`, { status: 200 });
    });
    const cachesMock = {
      keys: async () => [...stores.keys()],
      delete: async (key: string) => stores.delete(key),
      open: async (key: string) => {
        const store = stores.get(key) ?? new Map<string, Response>();
        stores.set(key, store);
        return {
          addAll: async (requests: string[]) => {
            for (const request of requests) {
              store.set(normalize(request), (await fetchMock(request)).clone());
            }
          },
          match: async (request: string | { url: string }) => store.get(normalize(request))?.clone(),
          put: async (request: string | { url: string }, response: Response) => {
            store.set(normalize(request), response.clone());
          },
        };
      },
      match: async (request: string | { url: string }) => {
        for (const store of stores.values()) {
          const response = store.get(normalize(request));
          if (response) return response.clone();
        }
        return undefined;
      },
    };
    const selfMock = {
      location: { origin: new URL(scope).origin },
      clients: { claim: vi.fn(async () => undefined) },
      skipWaiting: vi.fn(),
      addEventListener: (type: string, listener: (event: ServiceWorkerEvent) => void) => listeners.set(type, listener),
    };

    runInNewContext(source, {
      URL,
      caches: cachesMock,
      fetch: fetchMock,
      self: selfMock,
    });

    let installPromise = Promise.resolve();
    listeners.get("install")?.({
      waitUntil: (promise) => { installPromise = promise.then(() => undefined); },
    });
    await installPromise;
    online = false;

    let navigationResponse: Promise<Response> | undefined;
    listeners.get("fetch")?.({
      request: { method: "GET", mode: "navigate", url: `${scope}experimento` },
      waitUntil: () => undefined,
      respondWith: (promise) => { navigationResponse = promise; },
    });
    expect(await (await navigationResponse)?.text()).toContain(`${scope}`);

    let chunkResponse: Promise<Response> | undefined;
    listeners.get("fetch")?.({
      request: { method: "GET", mode: "cors", url: `${scope}assets/Entity002-cafe.js` },
      waitUntil: () => undefined,
      respondWith: (promise) => { chunkResponse = promise; },
    });
    expect(await (await chunkResponse)?.text()).toContain("Entity002-cafe.js");
    expect(fetchMock).toHaveBeenCalledTimes(urls.length + 1);
  });
});
