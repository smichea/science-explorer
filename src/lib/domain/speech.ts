/**
 * Helpers for reading authored prose aloud with the browser's speech synthesis.
 * Pure functions: no DOM, no timers.
 */

const MATH_WORD: Record<string, string> = { fr: 'formule', en: 'formula' };

/** Turns Markdown + LaTeX prose into plain text a speech synthesiser can read. */
export function speakableText(source: string | undefined | null, locale = 'fr'): string {
  if (!source) return '';
  const math = ` ${MATH_WORD[locale] ?? MATH_WORD.fr} `;
  let text = source.replace(/\r\n?/g, '\n');
  text = text.replace(/\$\$[\s\S]*?\$\$/g, math).replace(/\$[^$\n]+\$/g, math);
  text = text.replace(/```[\s\S]*?```/g, ' ').replace(/`([^`]*)`/g, '$1');
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '').replace(/^\s*>\s?/gm, '');
  text = text.replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '');
  text = text
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, '$1$2');
  // Leftover emphasis markers; underscores inside identifiers (route_first) are kept.
  text = text.replace(/\*{1,3}/g, '').replace(/(^|\s)_+|_+(?=\s|$)/g, '$1');
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

/** Splits plain text into sentences so that each utterance stays short (browsers cut long ones). */
export function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    // Glue what cannot stand alone: after a capitalised abbreviation ("M." in "M. Galilei"; a
    // lower-case single letter such as a variable "x." ends a sentence), very short fragments,
    // or a fragment that starts in lower case.
    const previous = out[out.length - 1];
    const afterAbbreviation = !!previous && /(^|\s)[A-ZÀ-Ý][a-zà-ÿ]?\.$/.test(previous);
    if (previous && (afterAbbreviation || part.length < 4 || /^[a-zà-ÿ]/.test(part)))
      out[out.length - 1] = `${previous} ${part}`;
    else out.push(part);
  }
  return out;
}

/** Time a reader needs for the text, used when no voice is available: at least 4 seconds. */
export function estimateReadingMs(text: string, wordsPerMinute = 170): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.max(4000, Math.round((words / wordsPerMinute) * 60_000) + 800);
}
