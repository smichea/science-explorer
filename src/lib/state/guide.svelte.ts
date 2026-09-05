import { profile } from './profile.svelte';

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SESSION_KEY = 'science-explorer.guide-unlocked-for';

function readSession(): string | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSession(value: string | null): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (value === null) sessionStorage.removeItem(SESSION_KEY);
    else sessionStorage.setItem(SESSION_KEY, value);
  } catch {
    /* private mode or storage disabled: the unlock simply does not survive a reload */
  }
}

/**
 * Guide mode is protected by an optional local PIN (not a security boundary, ADR-0008).
 * An unlock lasts for the browser tab (sessionStorage): a reload keeps the guide pages open,
 * a new tab or a restart asks for the PIN again.
 */
class GuideState {
  unlockedFor = $state<string | null>(readSession());

  get hasPin(): boolean {
    return !!profile.settings?.guidePinHash;
  }

  get unlocked(): boolean {
    if (!profile.active) return false;
    if (!this.hasPin) return true;
    return this.unlockedFor === profile.active.id;
  }

  async unlock(pin: string): Promise<boolean> {
    const settings = profile.settings;
    if (!settings?.guidePinHash || !settings.guidePinSalt) return true;
    const hash = await sha256(`${settings.guidePinSalt}:${pin}`);
    if (hash === settings.guidePinHash) {
      this.unlockedFor = profile.active?.id ?? null;
      writeSession(this.unlockedFor);
      return true;
    }
    return false;
  }

  lock(): void {
    this.unlockedFor = null;
    writeSession(null);
  }

  async setPin(pin: string): Promise<void> {
    const salt = randomSalt();
    const hash = await sha256(`${salt}:${pin}`);
    await profile.saveSettings({ guidePinHash: hash, guidePinSalt: salt });
    this.unlockedFor = profile.active?.id ?? null;
    writeSession(this.unlockedFor);
  }

  async clearPin(): Promise<void> {
    await profile.saveSettings({ guidePinHash: undefined, guidePinSalt: undefined });
    this.unlockedFor = null;
    writeSession(null);
  }
}

export const guide = new GuideState();
