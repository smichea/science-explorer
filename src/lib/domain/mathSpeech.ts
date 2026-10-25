import katex from 'katex';
import baseRules from 'speech-rule-engine/lib/mathmaps/base.json';
import englishRules from 'speech-rule-engine/lib/mathmaps/en.json';
import frenchRules from 'speech-rule-engine/lib/mathmaps/fr.json';

// The rules travel with the application and its offline cache. Initialising the engine
// before this module resolves keeps the shared prose/sentence helpers synchronous.
const rules: Record<string, string> = {
  base: JSON.stringify(baseRules),
  en: JSON.stringify(englishRules),
  fr: JSON.stringify(frenchRules),
};
const host = globalThis as typeof globalThis & { SREfeature?: Record<string, unknown> };
const previousFeature = host.SREfeature;
const custom = async (locale: string): Promise<string> => {
  if (!rules[locale]) throw new Error(`Unsupported speech locale: ${locale}`);
  return rules[locale];
};
host.SREfeature = { custom };
const module = await import('speech-rule-engine');
const engine = module.default ?? module;
await engine.engineReady();
await engine.setupEngine({ locale: 'fr', domain: 'clearspeak', markup: 'none', custom });
await engine.engineReady();
await engine.setupEngine({ locale: 'en' });
await engine.engineReady();
host.SREfeature = previousFeature;

const cache = new Map<string, string>();

/** A literal, non-empty fallback for malformed TeX; never hide the expression. */
function literalMath(source: string, english: boolean): string {
  return source
    .replace(/\\([a-zA-Z]+)/g, '$1 ')
    .replace(/[λ]/g, ' lambda ')
    .replace(/\^/g, english ? ' to the power of ' : ' puissance ')
    .replace(/_/g, english ? ' subscript ' : ' indice ')
    .replace(/=/g, english ? ' equals ' : ' égale ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Read the MathML structure of the same TeX rendered on screen, in either site language. */
export function spokenMath(source: string, locale = 'fr'): string {
  const lang = locale === 'en' ? 'en' : 'fr';
  const key = `${lang}:${source}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  let spoken = '';
  try {
    const html = katex.renderToString(source, {
      output: 'mathml',
      throwOnError: true,
      strict: 'ignore',
      trust: false,
      maxExpand: 200,
    });
    // KaTeX wraps <math> in a span. Its combining vector accent needs the equivalent
    // standalone arrow for the speech engine's accent rules.
    const mathml = html.match(/<math[\s\S]*<\/math>/)?.[0].replaceAll('\u20d7', '→');
    if (mathml) {
      // Both locales are already loaded. setupEngine changes the active rules synchronously
      // before returning its (already fulfilled) loading promise; no task can interleave here.
      void engine.setupEngine({ locale: lang });
      spoken = engine.toSpeech(mathml).replace(/\blamda\b/g, 'lambda');
      if (lang === 'fr') {
        // Correct untranslated/ungendered labels in the bundled French ClearSpeak rules.
        spoken = spoken
          .replace(/\bsub\b/g, 'indice')
          .replace(/\ble intégrale\b/g, 'l’intégrale')
          .replace(/\ble sommation\b/g, 'la somme');
      }
    }
  } catch {
    // A malformed expression must not stop the rest of the lesson or erase its notation.
  }
  const result = spoken.trim() || literalMath(source, lang === 'en');
  if (cache.size >= 1024) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}
