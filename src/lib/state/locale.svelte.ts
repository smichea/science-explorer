import type { Locale, LocalisedList, LocalisedText } from '$lib/content-schema';
import { localise, localiseList, translate, type MessageKey, type MessageParams } from '$lib/domain/i18n';
import { readLocale, writeLocale } from '$lib/persistence/localStorage';

class LocaleState {
  current = $state<Locale>('fr');

  init(): void {
    const saved = readLocale();
    if (saved) this.current = saved;
    else if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en')) this.current = 'en';
    this.apply();
  }

  set(next: Locale): void {
    if (next === this.current) return;
    this.current = next;
    writeLocale(next);
    this.apply();
  }

  apply(): void {
    if (typeof document !== 'undefined') document.documentElement.lang = this.current;
  }
}

export const locale = new LocaleState();

/** Interface string in the active locale. */
export function t(key: MessageKey, params?: MessageParams): string {
  return translate(locale.current, key, params);
}

/** Content text in the active locale. */
export function L(field?: LocalisedText): string {
  return localise(field, locale.current);
}

export function LL(field?: LocalisedList): string[] {
  return localiseList(field, locale.current);
}
