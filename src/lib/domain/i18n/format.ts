import type { Locale } from '../../content-schema/common';
import type { HistoricalDate } from '../../content-schema/common';

const INTL_UNITS: Record<string, string> = {
  m: 'meter',
  s: 'second',
  'm/s': 'meter-per-second',
  km: 'kilometer',
  min: 'minute',
  h: 'hour',
  kg: 'kilogram',
  g: 'gram',
  ms: 'millisecond',
  '%': 'percent',
};

/** Locale-aware number formatting: "9,81 m/s" in French, "9.81 m/s" in English. */
export function formatNumber(
  value: number,
  locale: Locale,
  options: { digits?: number; unit?: string; maximumSignificantDigits?: number } = {}
): string {
  if (!Number.isFinite(value)) return '—';
  const { digits, unit, maximumSignificantDigits } = options;
  const base: Intl.NumberFormatOptions =
    maximumSignificantDigits !== undefined
      ? { maximumSignificantDigits }
      : { minimumFractionDigits: digits ?? 0, maximumFractionDigits: digits ?? 2 };
  const intlUnit = unit ? INTL_UNITS[unit] : undefined;
  if (intlUnit) {
    try {
      return new Intl.NumberFormat(locale, {
        ...base,
        style: 'unit',
        unit: intlUnit,
        unitDisplay: 'short',
      }).format(value);
    } catch {
      /* fall through to the plain form */
    }
  }
  const text = new Intl.NumberFormat(locale, base).format(value);
  return unit ? `${text}\u00a0${unit}` : text;
}

export function formatPercent(value: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits }).format(
    value
  );
}

/** Parses "9,81", "9.81", "1,2e3" or "1 200" into a number; returns NaN when unreadable. */
export function parseLocaleNumber(input: string): number {
  const cleaned = input
    .trim()
    .replace(/\s|\u00a0|\u202f/g, '')
    .replace(/−/g, '-');
  if (cleaned === '') return NaN;
  // A comma is a decimal separator unless a dot is also present (then it is a thousands separator).
  const normalised = cleaned.includes('.') ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(normalised)) return NaN;
  return Number(normalised);
}

export function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
}

export function formatDateTime(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

/** Historical dates carry their own display string; the certainty is added when it is not exact. */
export function formatHistoricalDate(date: HistoricalDate, locale: Locale): string {
  return date.display[locale] ?? date.display.fr;
}

export function formatDuration(minutes: number, locale: Locale): string {
  if (minutes < 60) return `${Math.round(minutes)}\u00a0min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return locale === 'fr'
    ? `${h}\u00a0h\u00a0${m.toString().padStart(2, '0')}`
    : `${h}\u00a0h ${m}\u00a0min`;
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
