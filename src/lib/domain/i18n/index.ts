import type { Locale, LocalisedList, LocalisedText } from '../../content-schema/common';
import { en, type MessageKey } from './messages.en';
import { fr } from './messages.fr';

export type { MessageKey };
export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { fr, en };

export type MessageParams = Record<string, string | number>;

/** Interpolates `{name}` placeholders. Missing keys are visibly flagged (they cannot happen at compile time). */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const template = MESSAGES[locale][key] ?? MESSAGES.en[key] ?? `⟦${key}⟧`;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}

/** Picks the localised value of an authored content field. Production content always has both languages. */
export function localise(field: LocalisedText | undefined, locale: Locale): string {
  if (!field) return '';
  const value = field[locale];
  if (value && value.length > 0) return value;
  const other: Locale = locale === 'fr' ? 'en' : 'fr';
  return field[other] ?? '';
}

export function localiseList(field: LocalisedList | undefined, locale: Locale): string[] {
  if (!field) return [];
  const value = field[locale];
  if (value && value.length > 0) return value;
  const other: Locale = locale === 'fr' ? 'en' : 'fr';
  return field[other] ?? [];
}

/** Returns true when a localised field misses a language (used by development diagnostics). */
export function hasMissingTranslation(field: LocalisedText | undefined): boolean {
  return !!field && (!field.fr || !field.en);
}
