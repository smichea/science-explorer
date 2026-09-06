import type { Locale } from '$lib/content-schema';
import { estimateReadingMs, splitSentences } from '$lib/domain/speech';

const LANG: Record<Locale, string> = { fr: 'fr-FR', en: 'en-GB' };

/**
 * Thin wrapper over the browser's speech synthesis (ADR-0013): no server, no audio files.
 * Text is spoken sentence by sentence (long utterances get cut by some browsers) and a watchdog
 * resolves every utterance even when the browser never reports its end.
 */
class SpeechState {
  available = $state(false);
  speaking = $state(false);
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private token = 0;

  init(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.synth = window.speechSynthesis;
    this.available = true;
    const load = () => {
      this.voices = this.synth?.getVoices() ?? [];
    };
    load();
    this.synth.addEventListener?.('voiceschanged', load);
  }

  private voiceFor(locale: Locale): SpeechSynthesisVoice | null {
    const lang = locale === 'fr' ? 'fr' : 'en';
    const candidates = this.voices.filter((v) => v.lang?.toLowerCase().startsWith(lang));
    return (
      candidates.find((v) => v.default) ??
      candidates.find((v) => v.localService) ??
      candidates[0] ??
      null
    );
  }

  /**
   * Speaks the text sentence by sentence; resolves true when read to the end, false when
   * cancelled or unavailable. `onSentence` is called as each sentence starts (a lesson uses it
   * to make its tool follow the words).
   */
  async speak(
    text: string,
    locale: Locale,
    onSentence?: (index: number, total: number) => void
  ): Promise<boolean> {
    if (!this.synth || !this.available || !text.trim()) return false;
    this.cancel();
    const token = ++this.token;
    this.speaking = true;
    const sentences = splitSentences(text);
    for (const [index, chunk] of sentences.entries()) {
      if (token !== this.token) return false;
      onSentence?.(index, sentences.length);
      const finished = await this.utter(chunk, locale, token);
      if (!finished) return false;
    }
    if (token === this.token) this.speaking = false;
    return true;
  }

  private utter(chunk: string, locale: Locale, token: number): Promise<boolean> {
    return new Promise((resolve) => {
      const synth = this.synth;
      if (!synth) return resolve(false);
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        resolve(value && token === this.token);
      };
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = LANG[locale];
      const voice = this.voiceFor(locale);
      if (voice) utterance.voice = voice;
      utterance.rate = 1;
      utterance.onend = () => settle(true);
      // Any error (no engine, not allowed, interrupted) counts as "not spoken": the flight then
      // paces itself on the reading time instead of racing through silent steps.
      utterance.onerror = () => settle(false);
      // Some engines never fire `end`: move on after the time a reader would need.
      const watchdog = setTimeout(() => settle(true), estimateReadingMs(chunk) + 3000);
      try {
        synth.speak(utterance);
      } catch {
        settle(false);
      }
    });
  }

  cancel(): void {
    this.token++;
    try {
      this.synth?.cancel();
    } catch {
      /* nothing to cancel */
    }
    this.speaking = false;
  }
}

export const speech = new SpeechState();
