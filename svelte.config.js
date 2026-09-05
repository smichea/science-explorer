import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Base path for GitHub Pages deployments (e.g. "/science-explorer"). Empty locally.
const base = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Single-page application: every route is served by the same shell, so deep links
    // keep working on a static host (GitHub Pages serves 404.html for unknown paths).
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html',
      precompress: false,
      strict: true,
    }),
    paths: { base },
    serviceWorker: { register: true },
  },
};

export default config;
