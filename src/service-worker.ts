/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { base, build, files, version } from '$service-worker';

/**
 * Offline shell (PRODUCT_SPECIFICATION §17, ADR-0009): the application shell, the bundled
 * content package and static files are precached at install; navigation requests fall back
 * to the cached shell. A new version is activated on the next launch, never mid-session.
 */
const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `science-explorer-${version}`;
const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // The application shell must be complete; static files (content package, icons) are best effort
      // and are also cached on first use by the fetch handler below.
      await cache.addAll(build);
      await Promise.allSettled(files.map((file) => cache.add(file)));
      // The SPA shell (adapter-static fallback) is not part of the build list: cache it separately.
      try {
        await cache.add(`${base}/404.html`);
      } catch {
        /* the shell will be cached on first navigation instead */
      }
    })()
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await sw.clients.claim();
    })()
  );
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Immutable build assets and bundled files: cache first.
      if (ASSETS.includes(url.pathname)) {
        const cached = await cache.match(url.pathname);
        if (cached) return cached;
      }
      try {
        const response = await fetch(request);
        // Keep a copy of successful same-origin responses (content JSON, fonts) for offline use.
        if (response.ok && (response.type === 'basic' || response.type === 'default')) {
          cache.put(request, response.clone()).catch(() => undefined);
        }
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = (await cache.match(`${base}/404.html`)) ?? (await findShell(cache));
          if (shell) return shell;
        }
        return new Response('offline', { status: 503, statusText: 'offline' });
      }
    })()
  );
});

async function findShell(cache: Cache): Promise<Response | undefined> {
  for (const path of ASSETS)
    if (path.endsWith('/404.html') || path.endsWith('/index.html')) {
      const hit = await cache.match(path);
      if (hit) return hit;
    }
  const keys = await cache.keys();
  const shell = keys.find((k) => k.url.endsWith('/404.html') || k.url.endsWith('/index.html'));
  return shell ? cache.match(shell) : undefined;
}
