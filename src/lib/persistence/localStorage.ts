import type { Locale } from '../content-schema/common';

export const LS = {
  schemaVersion: 'science-explorer.schema-version',
  activeProfileId: 'science-explorer.active-profile-id',
  profileIndex: 'science-explorer.profile-index',
  locale: 'science-explorer.locale',
  uiPreferences: 'science-explorer.ui-preferences',
} as const;

export const STORAGE_SCHEMA_VERSION = 1;

export interface ProfileSummary {
  id: string;
  name: string;
  age: number;
  preferredLocale: Locale;
  lastOpenedAt: string;
}

export interface ProfileIndex {
  schemaVersion: number;
  profiles: ProfileSummary[];
}

export type PerformanceMode = 'high' | 'balanced' | 'reduced' | '2d';

export interface UiPreferences {
  performanceMode: PerformanceMode | 'auto';
  reducedMotion: boolean | 'system';
  textScale: number;
  mapView: '3d' | '2d';
  lastRoute?: string;
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  performanceMode: 'auto',
  reducedMotion: 'system',
  textScale: 1,
  mapView: '3d',
};

/** Minimal storage abstraction so the same code runs in tests (Map-backed). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let storage: StorageLike | null = null;

export function setStorage(s: StorageLike | null): void {
  storage = s;
}

function store(): StorageLike | null {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* storage blocked */
  }
  return null;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = store()?.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or blocked storage: the app keeps working in memory */
  }
}

export function readLocale(): Locale | null {
  const v = store()?.getItem(LS.locale);
  return v === 'fr' || v === 'en' ? v : null;
}

export function writeLocale(locale: Locale): void {
  try {
    store()?.setItem(LS.locale, locale);
  } catch {
    /* ignore */
  }
}

export function readActiveProfileId(): string | null {
  return store()?.getItem(LS.activeProfileId) ?? null;
}

export function writeActiveProfileId(id: string | null): void {
  try {
    if (id) store()?.setItem(LS.activeProfileId, id);
    else store()?.removeItem(LS.activeProfileId);
  } catch {
    /* ignore */
  }
}

export function readProfileIndex(): ProfileIndex {
  const index = readJson<ProfileIndex>(LS.profileIndex, { schemaVersion: STORAGE_SCHEMA_VERSION, profiles: [] });
  if (!Array.isArray(index.profiles)) index.profiles = [];
  return index;
}

export function writeProfileIndex(index: ProfileIndex): void {
  writeJson(LS.profileIndex, index);
  try {
    store()?.setItem(LS.schemaVersion, String(STORAGE_SCHEMA_VERSION));
  } catch {
    /* ignore */
  }
}

export function upsertProfileSummary(summary: ProfileSummary): void {
  const index = readProfileIndex();
  const i = index.profiles.findIndex((p) => p.id === summary.id);
  if (i >= 0) index.profiles[i] = summary;
  else index.profiles.push(summary);
  writeProfileIndex(index);
}

export function removeProfileSummary(id: string): void {
  const index = readProfileIndex();
  index.profiles = index.profiles.filter((p) => p.id !== id);
  writeProfileIndex(index);
}

export function readUiPreferences(): UiPreferences {
  return readJson<UiPreferences>(LS.uiPreferences, DEFAULT_UI_PREFERENCES);
}

export function writeUiPreferences(prefs: UiPreferences): void {
  writeJson(LS.uiPreferences, prefs);
}
