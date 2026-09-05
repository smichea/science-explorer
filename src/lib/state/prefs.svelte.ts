import {
  DEFAULT_UI_PREFERENCES,
  readUiPreferences,
  writeUiPreferences,
  type PerformanceMode,
  type UiPreferences,
} from '$lib/persistence/localStorage';

function detectPerformance(): PerformanceMode {
  if (typeof navigator === 'undefined') return 'balanced';
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const small = typeof window !== 'undefined' && window.innerWidth < 480;
  if (cores <= 2 || memory <= 2) return 'reduced';
  if (cores <= 4 || memory <= 4 || small) return 'balanced';
  return 'high';
}

class PrefsState {
  prefs = $state<UiPreferences>({ ...DEFAULT_UI_PREFERENCES });
  systemReducedMotion = $state(false);
  webglAvailable = $state<boolean | null>(null);

  init(): void {
    this.prefs = readUiPreferences();
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.systemReducedMotion = mq.matches;
      mq.addEventListener?.('change', (e) => (this.systemReducedMotion = e.matches));
    }
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--text-scale', String(this.prefs.textScale));
    }
  }

  update(patch: Partial<UiPreferences>): void {
    this.prefs = { ...this.prefs, ...patch };
    writeUiPreferences(this.prefs);
    if (typeof document !== 'undefined')
      document.documentElement.style.setProperty('--text-scale', String(this.prefs.textScale));
  }

  get reducedMotion(): boolean {
    return this.prefs.reducedMotion === 'system'
      ? this.systemReducedMotion
      : this.prefs.reducedMotion;
  }

  get performanceMode(): PerformanceMode {
    if (this.webglAvailable === false) return '2d';
    return this.prefs.performanceMode === 'auto' ? detectPerformance() : this.prefs.performanceMode;
  }
}

export const prefs = new PrefsState();
