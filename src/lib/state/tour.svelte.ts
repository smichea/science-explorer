import { estimateReadingMs, speakableText } from '$lib/domain/speech';
import { buildTour, countTourStops, type TourFocus, type TourStep } from '$lib/domain/tour';
import { content } from './content.svelte';
import { learning } from './learning.svelte';
import { L, locale } from './locale.svelte';
import { prefs } from './prefs.svelte';
import { speech } from './speech.svelte';

export type TourStatus = 'idle' | 'playing' | 'paused' | 'finished';

/**
 * The bird's-eye flight: an ordered sequence of steps flown over automatically. Each step is
 * shown as a card (the caption) and read aloud when a voice is available; the camera follows
 * through `focus`. The URL never changes during a flight.
 */
class TourState {
  steps = $state.raw<TourStep[]>([]);
  index = $state(0);
  status = $state<TourStatus>('idle');
  /** Increments on every step change so the atlas re-flies even to the same target. */
  tick = $state(0);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private run = 0;

  get active(): boolean {
    return this.status !== 'idle';
  }

  get total(): number {
    return this.steps.length;
  }

  get current(): TourStep | null {
    return this.steps[this.index] ?? null;
  }

  get focus(): TourFocus | null {
    return this.current?.focus ?? null;
  }

  get currentNodeId(): string | null {
    const step = this.current;
    return step?.kind === 'stop' ? step.node.id : null;
  }

  /** Destinations of the leg being flown, highlighted on the map. */
  get legNodeIds(): string[] {
    const step = this.current;
    if (step?.kind !== 'stop' && step?.kind !== 'leg') return [];
    const legIndex = step.legIndex;
    const leg = this.steps.find((s) => s.kind === 'leg' && s.legIndex === legIndex);
    return leg?.kind === 'leg' ? leg.nodeIds : [];
  }

  get highlightIds(): Set<string> {
    return new Set(this.legNodeIds);
  }

  get stops(): number {
    return countTourStops(this.steps);
  }

  get voiceOn(): boolean {
    return prefs.prefs.voice ?? prefs.prefs.tourVoice ?? true;
  }

  get includeDone(): boolean {
    return !!prefs.prefs.tourIncludeDone;
  }

  get includeFoundations(): boolean {
    return !!prefs.prefs.tourIncludeFoundations;
  }

  private build(): TourStep[] | null {
    const definition = content.pkg?.tours[0];
    const ctx = learning.destinationContext();
    if (!definition || !ctx || !content.pkg) return null;
    return buildTour(
      definition,
      {
        graph: ctx.graph,
        routes: content.pkg.routes,
        horizon: ctx.horizon,
        config: ctx.config,
        snapshot: ctx.snapshot,
      },
      { includeDone: this.includeDone, includeFoundations: this.includeFoundations }
    );
  }

  /** Number of destinations the flight would visit right now (for the start button). */
  plannedStops(): number {
    const steps = this.build();
    return steps ? countTourStops(steps) : 0;
  }

  /** Starts the flight defined by the content package; false when nothing can be flown. */
  start(): boolean {
    const steps = this.build();
    if (!steps) return false;
    this.steps = steps;
    this.index = 0;
    this.status = 'playing';
    this.tick++;
    void this.play();
    return true;
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private spokenText(step: TourStep): string {
    const body = speakableText(L(step.text), locale.current);
    if (step.kind === 'stop') return `${L(step.node.title)}. ${body}`;
    if (step.kind === 'leg') return `${L(step.title)}. ${body}`;
    return body;
  }

  private async play(): Promise<void> {
    const run = ++this.run;
    speech.cancel();
    this.clearTimer();
    const step = this.current;
    if (!step || this.status !== 'playing') return;
    const text = this.spokenText(step);
    let spoken = false;
    if (this.voiceOn && speech.available) {
      spoken = await speech.speak(text, locale.current);
      if (run !== this.run || this.status !== 'playing') return;
    }
    // A pause after the voice, or the reading time when no voice was heard.
    this.timer = setTimeout(() => this.advance(run), spoken ? 900 : estimateReadingMs(text));
  }

  private advance(run: number): void {
    if (run !== this.run || this.status !== 'playing') return;
    if (this.index >= this.steps.length - 1) {
      this.status = 'finished';
      return;
    }
    this.index++;
    this.tick++;
    void this.play();
  }

  next(): void {
    if (!this.active) return;
    if (this.index >= this.steps.length - 1) {
      this.status = 'finished';
      speech.cancel();
      this.clearTimer();
      return;
    }
    this.index++;
    this.tick++;
    if (this.status === 'finished') this.status = 'paused';
    void this.play();
  }

  prev(): void {
    if (!this.active || this.index === 0) return;
    this.index--;
    this.tick++;
    if (this.status === 'finished') this.status = 'paused';
    void this.play();
  }

  togglePause(): void {
    if (this.status === 'playing') {
      this.status = 'paused';
      this.run++;
      speech.cancel();
      this.clearTimer();
    } else if (this.status === 'paused' || this.status === 'finished') {
      if (this.status === 'finished') {
        this.index = 0;
        this.tick++;
      }
      this.status = 'playing';
      void this.play();
    }
  }

  setVoice(on: boolean): void {
    prefs.update({ voice: on, tourVoice: on });
    if (this.status === 'playing') void this.play();
    else speech.cancel();
  }

  setIncludeDone(value: boolean): void {
    prefs.update({ tourIncludeDone: value });
    if (this.active) this.start();
  }

  setIncludeFoundations(value: boolean): void {
    prefs.update({ tourIncludeFoundations: value });
    if (this.active) this.start();
  }

  exit(): void {
    this.run++;
    speech.cancel();
    this.clearTimer();
    this.status = 'idle';
    this.steps = [];
    this.index = 0;
  }
}

export const tour = new TourState();
