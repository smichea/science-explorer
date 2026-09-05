<script lang="ts">
  import '../app.css';
  import 'katex/dist/katex.min.css';
  import { onMount, untrack } from 'svelte';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import AppNav from '$lib/components/AppNav.svelte';
  import { announcer } from '$lib/accessibility/announce.svelte';
  import { content } from '$lib/state/content.svelte';
  import { locale, t } from '$lib/state/locale.svelte';
  import { prefs } from '$lib/state/prefs.svelte';
  import { profile } from '$lib/state/profile.svelte';
  import { learning } from '$lib/state/learning.svelte';

  let { children } = $props();
  let booted = $state(false);
  let online = $state(true);

  const PUBLIC = ['/welcome', '/profiles'];
  const path = $derived(page.url.pathname.slice(base.length) || '/');
  const isPublic = $derived(PUBLIC.some((p) => path === p || path.startsWith(p + '/')));
  const showNav = $derived(booted && !!profile.active && !isPublic && content.status === 'ready');

  onMount(() => {
    locale.init();
    prefs.init();
    online = navigator.onLine;
    const up = () => (online = true);
    const down = () => (online = false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    Promise.all([content.load(base), profile.init()]).then(() => {
      booted = true;
    });
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  });

  // Keep the learner's evidence and sessions loaded for the active profile.
  $effect(() => {
    const id = profile.active?.id ?? null;
    untrack(() => void learning.bind(id));
  });

  // Route guard: without an active explorer, only the welcome and profiles pages are reachable.
  $effect(() => {
    if (!booted || content.status !== 'ready') return;
    if (!profile.active && !isPublic) void goto(`${base}/welcome`, { replaceState: true });
  });

  // The locale attribute follows the active language (also used by tests).
  $effect(() => {
    document.documentElement.lang = locale.current;
  });
</script>

<svelte:head>
  <title>{t('app.name')}</title>
  <meta name="description" content={t('app.tagline')} />
</svelte:head>

<a class="skip-link" href="#main">{t('app.skipToContent')}</a>

{#if showNav}
  <AppNav />
{/if}

<div class="app-live visually-hidden" aria-live="polite" role="status">{announcer.message}</div>

{#if !online}
  <div class="offline-banner" role="status">{t('app.offline')}</div>
{/if}

<main id="main" class="app-main" class:with-nav={showNav} tabindex="-1">
  {#if content.status === 'error'}
    <div class="container stack" style="padding-top: var(--space-7)">
      <h1>{t('app.name')}</h1>
      <p class="error">{t('app.loadError')}</p>
      <p class="muted small">{content.error}</p>
    </div>
  {:else if !booted}
    <div class="boot" aria-busy="true">
      <div class="boot__orb" aria-hidden="true"></div>
      <p>{t('app.loading')}</p>
    </div>
  {:else}
    {@render children()}
  {/if}
</main>

<style>
  .app-main {
    min-height: 100dvh;
    outline: none;
  }
  .boot {
    min-height: 100dvh;
    display: grid;
    place-content: center;
    gap: var(--space-4);
    text-align: center;
    color: var(--muted);
  }
  .boot__orb {
    width: 64px;
    height: 64px;
    margin: 0 auto;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #ffffff, var(--accent) 45%, transparent 72%);
    box-shadow: 0 0 60px rgba(127, 156, 255, 0.5);
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      transform: scale(1.12);
      opacity: 0.85;
    }
  }
  .offline-banner {
    position: fixed;
    top: calc(var(--safe-top) + var(--space-2));
    left: 50%;
    transform: translateX(-50%);
    z-index: 60;
    padding: 0.3rem 0.9rem;
    border-radius: 999px;
    background: var(--warn);
    color: #000;
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  @media (max-width: 700px) {
    .app-main.with-nav {
      padding-bottom: calc(var(--nav-height) + var(--safe-bottom) + var(--space-4));
    }
  }
</style>
