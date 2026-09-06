import type { AnswerCheck } from '$lib/domain/answers';
import type { LessonStep } from '$lib/content-schema';
import { plotterStateAt, type LessonPlan, type PlotterState } from '$lib/domain/lesson';
import { speakableText, splitSentences } from '$lib/domain/speech';
import { L, locale } from './locale.svelte';
import { prefs } from './prefs.svelte';
import { speech } from './speech.svelte';

export type LessonStatus = 'idle' | 'playing' | 'paused' | 'finished';

export interface ExerciseRecord {
  correct: boolean;
  score: number;
  attempts: number;
  value: unknown;
}

/** Reading time of one sentence when no voice is heard (a lesson is read slower than a flight). */
function sentenceMs(sentence: string): number {
  const words = sentence.trim() ? sentence.trim().split(/\s+/).length : 0;
  return Math.max(1500, Math.round((words / 150) * 60_000) + 600);
}

/**
 * A lesson being followed: slides read aloud sentence by sentence (the tool follows the current
 * sentence), a free play, exercises. Slides advance by themselves; the play and the exercises wait
 * for the learner.
 */
class LessonState {
  plan = $state.raw<LessonPlan | null>(null);
  index = $state(0);
  status = $state<LessonStatus>('idle');
  /** Index of the sentence being read; null once the text of the step is finished. */
  sentence = $state<number | null>(null);
  /** Increments on every step change (focus management). */
  tick = $state(0);
  records = $state<Record<string, ExerciseRecord>>({});
  hints = $state<Record<string, string[]>>({});
  /** Parameter values moved by the learner (free play), on top of the authored ones. */
  paramOverrides = $state<Record<string, number>>({});
  /** The learner's own expression (free play). */
  customExpression = $state('');
  /** Abscissa of the learner's marker on the plotter, null when hidden. */
  marker = $state<number | null>(null);
  private run = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  get active(): boolean {
    return this.status !== 'idle' && !!this.plan;
  }

  get steps(): LessonStep[] {
    return this.plan?.steps ?? [];
  }

  get total(): number {
    return this.steps.length;
  }

  get step(): LessonStep | null {
    return this.steps[this.index] ?? null;
  }

  get voiceOn(): boolean {
    return prefs.prefs.voice ?? prefs.prefs.tourVoice ?? true;
  }

  /** The plotter after the actions fired so far, with the learner's parameter values on top. */
  get plotter(): PlotterState | null {
    const plan = this.plan;
    if (!plan || plan.tool?.kind !== 'plotter') return null;
    const base = plotterStateAt(plan.tool, plan.steps, this.index, this.sentence);
    return { ...base, params: { ...base.params, ...this.paramOverrides } };
  }

  /** Whether the learner may handle the tool on the current step. */
  get interactive(): boolean {
    return this.step?.kind === 'play' || this.step?.kind === 'exercises';
  }

  get solved(): number {
    return Object.values(this.records).filter((r) => r.correct).length;
  }

  open(plan: LessonPlan): void {
    this.exit();
    this.plan = plan;
    this.index = 0;
    this.status = 'playing';
    this.records = {};
    this.hints = {};
    this.tick++;
    void this.play();
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timer = setTimeout(resolve, ms);
    });
  }

  private async narrate(step: LessonStep, run: number): Promise<boolean> {
    const text = speakableText(L(step.text), locale.current);
    const sentences = splitSentences(text);
    this.sentence = 0;
    if (this.voiceOn && speech.available) {
      const spoken = await speech.speak(text, locale.current, (i) => {
        if (run === this.run) this.sentence = i;
      });
      if (run !== this.run) return false;
      if (spoken) return true;
    }
    // No voice heard: pace the sentences on their reading time, from where the voice stopped.
    for (let i = this.sentence ?? 0; i < sentences.length; i++) {
      if (run !== this.run || this.status !== 'playing') return false;
      this.sentence = i;
      await this.sleep(sentenceMs(sentences[i]));
    }
    return run === this.run && this.status === 'playing';
  }

  private async play(): Promise<void> {
    const run = ++this.run;
    speech.cancel();
    this.clearTimer();
    const step = this.step;
    if (!step || this.status !== 'playing') return;
    const finished = await this.narrate(step, run);
    if (run !== this.run || !finished) return;
    this.sentence = null;
    if (step.kind === 'slide') {
      await this.sleep(1200);
      if (run === this.run && this.status === 'playing') this.next();
    } else {
      // The play and the exercises wait for the learner.
      this.status = 'paused';
    }
  }

  private go(index: number): void {
    const target = this.steps[index];
    if (!target) return;
    this.index = index;
    this.sentence = null;
    this.tick++;
    if (target.kind === 'slide') this.paramOverrides = {};
    if (this.status === 'finished') this.status = 'paused';
    if (this.status === 'paused') this.status = 'playing';
    void this.play();
  }

  next(): void {
    if (!this.active) return;
    if (this.index >= this.total - 1) {
      this.run++;
      speech.cancel();
      this.clearTimer();
      this.status = 'finished';
      return;
    }
    this.go(this.index + 1);
  }

  prev(): void {
    if (!this.active || this.index === 0) return;
    this.go(this.index - 1);
  }

  /** Pauses the reading, or reads the current step (again). */
  togglePause(): void {
    if (this.status === 'playing') {
      this.status = 'paused';
      this.run++;
      speech.cancel();
      this.clearTimer();
      this.sentence = null;
    } else if (this.status === 'paused' || this.status === 'finished') {
      this.status = 'playing';
      void this.play();
    }
  }

  setVoice(on: boolean): void {
    prefs.update({ voice: on, tourVoice: on });
    if (this.status === 'playing') void this.play();
    else speech.cancel();
  }

  setParameter(id: string, value: number): void {
    this.paramOverrides = { ...this.paramOverrides, [id]: value };
  }

  /** Records an answer; returns the attempt number. */
  recordResult(exerciseId: string, check: AnswerCheck, value: unknown): number {
    const previous = this.records[exerciseId];
    const attempts = (previous?.attempts ?? 0) + 1;
    this.records = {
      ...this.records,
      [exerciseId]: {
        correct: check.correct || !!previous?.correct,
        score: Math.max(check.score, previous?.score ?? 0),
        attempts,
        value,
      },
    };
    return attempts;
  }

  openHint(exerciseId: string, hintId: string): void {
    const opened = this.hints[exerciseId] ?? [];
    if (opened.includes(hintId)) return;
    this.hints = { ...this.hints, [exerciseId]: [...opened, hintId] };
  }

  exit(): void {
    this.run++;
    speech.cancel();
    this.clearTimer();
    this.status = 'idle';
    this.plan = null;
    this.index = 0;
    this.sentence = null;
    this.paramOverrides = {};
    this.customExpression = '';
    this.marker = null;
  }
}

export const lesson = new LessonState();
