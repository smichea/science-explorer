<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import LocaleSwitch from './LocaleSwitch.svelte';
  import { t } from '$lib/state/locale.svelte';
  import { profile } from '$lib/state/profile.svelte';

  const links = $derived([
    {
      href: `${base}/universe`,
      label: t('nav.universe'),
      icon: '✦',
      match: ['/universe', '/world', '/region', '/concept', '/mission'],
    },
    { href: `${base}/backpack`, label: t('nav.backpack'), icon: '🎒', match: ['/backpack'] },
    {
      href: `${base}/journal`,
      label: t('nav.journal'),
      icon: '📓',
      match: ['/journal', '/timeline'],
    },
    { href: `${base}/guide/progress`, label: t('nav.guide'), icon: '🧭', match: ['/guide'] },
    {
      href: `${base}/settings`,
      label: t('nav.settings'),
      icon: '⚙',
      match: ['/settings', '/profiles', '/studio'],
    },
  ]);

  const path = $derived(page.url.pathname.slice(base.length) || '/');
  const isActive = (match: string[]) => match.some((m) => path === m || path.startsWith(m + '/'));
</script>

<nav class="appnav" aria-label={t('nav.menu')}>
  <a class="brand" href="{base}/universe">
    <span class="brand__mark" aria-hidden="true">✦</span>
    <span class="brand__name">{t('app.name')}</span>
  </a>
  <ul class="appnav__links">
    {#each links as link (link.href)}
      <li>
        <a href={link.href} aria-current={isActive(link.match) ? 'page' : undefined}>
          <span class="appnav__icon" aria-hidden="true">{link.icon}</span>
          <span class="appnav__label">{link.label}</span>
        </a>
      </li>
    {/each}
  </ul>
  <div class="appnav__side">
    {#if profile.active}
      <a class="appnav__who" href="{base}/profiles" title={t('nav.profiles')}
        >{profile.active.name}</a
      >
    {/if}
    <LocaleSwitch compact />
  </div>
</nav>

<style>
  .appnav {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    min-height: var(--nav-height);
    padding: var(--safe-top) calc(var(--space-4) + var(--safe-right)) 0
      calc(var(--space-4) + var(--safe-left));
    background: rgba(11, 16, 32, 0.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .brand {
    min-height: 40px;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text);
    text-decoration: none;
    font-weight: 700;
    white-space: nowrap;
  }
  .brand__mark {
    color: var(--accent-2);
  }
  .appnav__links {
    display: flex;
    gap: var(--space-1);
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1;
  }
  .appnav__links a {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 40px;
    padding: 0.3rem 0.8rem;
    border-radius: 999px;
    color: var(--muted);
    text-decoration: none;
  }
  .appnav__links a[aria-current='page'] {
    background: var(--surface-2);
    color: var(--text);
  }
  .appnav__side {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .appnav__who {
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    color: var(--text);
    text-decoration: none;
    font-weight: 600;
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 1024px) {
    .appnav {
      gap: var(--space-2);
      padding-left: calc(var(--space-2) + var(--safe-left));
      padding-right: calc(var(--space-2) + var(--safe-right));
    }
    .brand__name {
      display: none;
    }
    .appnav__links {
      flex: 1;
      min-width: 0;
      justify-content: space-around;
    }
    .appnav__links a {
      flex-direction: column;
      gap: 0.1rem;
      padding: 0.25rem 0.4rem;
      font-size: 0.7rem;
      min-width: 44px;
      min-height: 44px;
    }
    .appnav__icon {
      font-size: 1.1rem;
    }
    .appnav__who {
      max-width: 6rem;
    }
  }
  @media (max-width: 700px) {
    .appnav {
      position: fixed;
      top: auto;
      bottom: 0;
      left: 0;
      right: 0;
      padding: var(--space-1) var(--space-2) calc(var(--space-1) + var(--safe-bottom));
      border-top: 1px solid var(--border);
      border-bottom: 0;
      gap: var(--space-2);
    }
    .brand__name,
    .appnav__who {
      display: none;
    }
    .appnav__links {
      justify-content: space-around;
    }
    .appnav__links a {
      flex-direction: column;
      gap: 0.1rem;
      padding: 0.25rem 0.5rem;
      font-size: 0.7rem;
      min-width: 44px;
      min-height: 44px;
    }
    .appnav__icon {
      font-size: 1.1rem;
    }
  }
</style>
