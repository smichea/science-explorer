<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { FirstOrderConfig, Motion2dConfig, SimulationDefinition } from '$lib/content-schema';
  import * as fo from '$lib/domain/simulation/firstOrder';
  import * as m2 from '$lib/domain/simulation/motion2d';
  import { formatNumber } from '$lib/domain/i18n/format';
  import { L, LL, locale, t } from '$lib/state/locale.svelte';
  import { prefs } from '$lib/state/prefs.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import Motion2DWorld from './Motion2DWorld.svelte';
  import TimeGraph from './TimeGraph.svelte';

  interface Measurement {
    t: number;
    value: number;
    label?: string;
  }
  interface Props {
    simulation: SimulationDefinition;
    measurements?: Measurement[];
    onmeasure?: (m: Measurement) => void;
    onparameter?: (variable: string, value: number) => void;
    compact?: boolean;
  }
  let { simulation, measurements = [], onmeasure, onparameter, compact = false }: Props = $props();

  const isMotion = $derived(simulation.engine === 'motion_2d');
  let config = $state<Motion2dConfig | FirstOrderConfig>(
    untrack(
      () => structuredClone($state.snapshot(simulation.config)) as Motion2dConfig | FirstOrderConfig
    )
  );
  let time = $state(0);
  let playing = $state(false);
  let speed = $state(1);
  let showTangent = $state(false);
  let frame = 0;
  let last = 0;

  const motionConfig = $derived(config as Motion2dConfig);
  const foConfig = $derived(config as FirstOrderConfig);
  const duration = $derived(isMotion ? Math.min(60, m2.duration(motionConfig)) : foConfig.duration);

  /** Precomputed trajectory (deterministic, fixed dt) — 120 samples per second. */
  const samples = $derived.by(() => {
    if (!isMotion) return [] as m2.Motion2dObservables[];
    const out: m2.Motion2dObservables[] = [];
    let state = m2.initialState(motionConfig);
    const sampleEvery = 1 / 120;
    let nextSample = 0;
    out.push(m2.observe(motionConfig, state));
    while (!state.finished && state.t < duration + 1e-9) {
      state = m2.step(motionConfig, state, motionConfig.dt);
      if (state.t >= nextSample + sampleEvery || state.finished) {
        out.push(m2.observe(motionConfig, state));
        nextSample = state.t;
      }
    }
    return out;
  });

  const motionNow = $derived.by((): m2.Motion2dObservables => {
    if (!isMotion)
      return {
        t: 0,
        x: 0,
        y: 0,
        s: 0,
        v: 0,
        a: 0,
        kinetic: 0,
        potential: 0,
        total: 0,
        finished: false,
      };
    if (samples.length === 0) return m2.observe(motionConfig, m2.initialState(motionConfig));
    const idx = Math.min(
      samples.length - 1,
      Math.floor((time / Math.max(1e-9, samples[samples.length - 1].t)) * (samples.length - 1))
    );
    return samples[Math.max(0, idx)];
  });
  const foNow = $derived(isMotion ? null : fo.observe(foConfig, fo.stateAt(foConfig, time)));

  const clockMarks = $derived.by(() => {
    if (!isMotion || motionConfig.scene !== 'inclined_plane')
      return [] as Array<{ t: number; s: number; label: string }>;
    const marks: Array<{ t: number; s: number; label: string }> = [];
    for (let k = 1; k <= 6; k++) {
      if (k > duration + 1e-9) break;
      const trueS = m2.distanceAtClockMark(motionConfig, k);
      marks.push({ t: k, s: trueS, label: `${k}` });
    }
    return marks;
  });

  const seriesPosition = $derived.by(() => {
    if (isMotion) {
      const key = motionConfig.scene === 'inclined_plane' ? 's' : 'y';
      return [
        {
          name: motionConfig.scene === 'inclined_plane' ? t('sim.distance') : t('sim.height'),
          color: '#7f9cff',
          points: samples.map((o) => [o.t, o[key]] as [number, number]),
        },
      ];
    }
    const pts: Array<[number, number]> = [];
    const n = 160;
    for (let i = 0; i <= n; i++) {
      const tt = (i / n) * foConfig.duration;
      pts.push([tt, fo.valueAt(foConfig, tt)]);
    }
    return [{ name: t('sim.quantity'), color: '#5ee6a8', points: pts }];
  });
  const seriesVelocity = $derived.by(() => {
    if (isMotion)
      return [
        {
          name: t('sim.velocity'),
          color: '#ffb347',
          points: samples.map((o) => [o.t, o.v] as [number, number]),
        },
      ];
    const pts: Array<[number, number]> = [];
    const n = 160;
    for (let i = 0; i <= n; i++) {
      const tt = (i / n) * foConfig.duration;
      pts.push([tt, fo.rateAt(foConfig, tt)]);
    }
    return [{ name: t('sim.rate'), color: '#ffb347', points: pts }];
  });
  const tangent = $derived(
    !isMotion && showTangent ? { t0: time, ...fo.tangentAt(foConfig, time) } : null
  );

  function loop(now: number) {
    if (!playing) return;
    const dt = Math.min(0.1, (now - last) / 1000) * speed;
    last = now;
    time = Math.min(duration, time + dt);
    if (time >= duration) playing = false;
    else frame = requestAnimationFrame(loop);
  }
  function play() {
    if (time >= duration) time = 0;
    playing = true;
    last = performance.now();
    frame = requestAnimationFrame(loop);
  }
  function pause() {
    playing = false;
    cancelAnimationFrame(frame);
  }
  function reset() {
    pause();
    time = 0;
  }
  function stepForward() {
    pause();
    time = Math.min(duration, time + (isMotion ? 0.25 : foConfig.duration / 24));
  }
  function setControl(variable: string, value: number) {
    reset();
    (config as unknown as Record<string, number>)[variable] = value;
    onparameter?.(variable, value);
  }
  function recordNow() {
    const value = isMotion
      ? motionConfig.scene === 'inclined_plane'
        ? motionNow.s
        : motionNow.y
      : foNow!.q;
    onmeasure?.({ t: Number(time.toFixed(3)), value: Number(value.toFixed(4)) });
  }
  function recordMark(mark: { t: number; s: number; label: string }) {
    const measured = m2.clockReading(motionConfig, simulation.seed, mark.t, mark.t);
    const value = m2.distanceAtClockMark(motionConfig, measured);
    onmeasure?.({
      t: mark.t,
      value: Number(value.toFixed(3)),
      label: `${t('sim.clockMark')} ${mark.label}`,
    });
  }

  onMount(() => () => cancelAnimationFrame(frame));

  const tableRows = $derived.by(() => {
    const rows: Array<{ t: number; a: number; b: number }> = [];
    if (isMotion) {
      for (let k = 0; k <= Math.min(12, Math.ceil(duration)); k++) {
        const o = samples.find((s) => s.t >= k) ?? samples[samples.length - 1];
        if (!o) break;
        rows.push({ t: k, a: motionConfig.scene === 'inclined_plane' ? o.s : o.y, b: o.v });
        if (o.finished) break;
      }
    } else {
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const tt = (i / n) * foConfig.duration;
        rows.push({ t: tt, a: fo.valueAt(foConfig, tt), b: fo.rateAt(foConfig, tt) });
      }
    }
    return rows;
  });
  const unitA = $derived(isMotion ? 'm' : foConfig.unit);
  const unitT = $derived(isMotion ? 's' : foConfig.timeUnit);
</script>

<div
  class="sim"
  class:sim--compact={compact}
  data-testid="simulation"
  data-simulation-id={simulation.id}
>
  <div class="sim__head">
    <div>
      <h3 style="margin: 0">{L(simulation.title)}</h3>
      <div class="muted small"><Markdown text={L(simulation.description)} /></div>
    </div>
  </div>

  <div class="sim__grid">
    <div class="sim__scene">
      {#if isMotion}
        <Motion2DWorld config={motionConfig} observables={motionNow} marks={clockMarks} />
      {:else}
        <TimeGraph
          series={seriesPosition}
          currentT={time}
          xLabel={unitT}
          yLabel={unitA}
          {tangent}
          title={t('sim.quantity')}
        />
      {/if}
      <div class="sim__transport" role="group" aria-label={t('sim.play')}>
        {#if playing}
          <button class="btn btn--sm" type="button" onclick={pause}>⏸ {t('sim.pause')}</button>
        {:else}
          <button
            class="btn btn--sm btn--primary"
            type="button"
            onclick={play}
            data-testid="sim-play">▶ {time >= duration ? t('sim.replay') : t('sim.play')}</button
          >
        {/if}
        <button class="btn btn--sm" type="button" onclick={stepForward} data-testid="sim-step"
          >⏭ {t('sim.step')}</button
        >
        <button class="btn btn--sm btn--ghost" type="button" onclick={reset}
          >↺ {t('sim.reset')}</button
        >
        <label class="sim__speed small">
          {t('sim.speed')}
          <select class="input" bind:value={speed} style="min-height: 36px; width: auto">
            <option value={0.25}>×0,25</option>
            <option value={0.5}>×0,5</option>
            <option value={1}>×1</option>
            <option value={2}>×2</option>
          </select>
        </label>
        <label class="sim__time small">
          {t('sim.time')}
          <input
            type="range"
            min="0"
            max={duration}
            step={duration / 400}
            bind:value={time}
            oninput={pause}
            aria-label={t('sim.time')}
          />
          <span class="mono">{formatNumber(time, locale.current, { digits: 2 })} {unitT}</span>
        </label>
      </div>
      {#if prefs.reducedMotion}<p class="muted small">{t('sim.reducedMotion')}</p>{/if}
      {#if isMotion && motionNow.finished}<p class="muted small">
          {motionConfig.scene === 'inclined_plane' ? t('sim.endOfPlane') : t('sim.landed')}
        </p>{/if}
    </div>

    <div class="sim__side">
      {#if simulation.controls.length}
        <fieldset class="sim__controls">
          <legend class="small muted">{t('sim.parameters')}</legend>
          {#each simulation.controls as c (c.variable)}
            <label class="sim__control small">
              <span
                >{L(c.label)}{c.unit ? ' (' + c.unit + ')' : ''} :
                <strong class="mono"
                  >{(config as unknown as Record<string, number>)[c.variable]}</strong
                ></span
              >
              <input
                type="range"
                min={c.min}
                max={c.max}
                step={c.step}
                value={(config as unknown as Record<string, number>)[c.variable]}
                onchange={(e) => setControl(c.variable, Number(e.currentTarget.value))}
                data-control={c.variable}
              />
            </label>
          {/each}
        </fieldset>
      {/if}

      {#if onmeasure}
        <div class="sim__measure stack-sm">
          <p class="small muted" style="margin:0">{t('sim.measurements')}</p>
          {#if clockMarks.length}
            <div class="cluster">
              {#each clockMarks as m (m.t)}
                <button
                  class="btn btn--sm"
                  type="button"
                  onclick={() => recordMark(m)}
                  data-testid="clock-mark-{m.t}"
                  >{t('sim.clockMark')}
                  {m.label} ({m.t}
                  {t(m.t > 1 ? 'sim.beats' : 'sim.beat')})</button
                >
              {/each}
            </div>
          {/if}
          <button
            class="btn btn--sm btn--primary"
            type="button"
            onclick={recordNow}
            data-testid="sim-record">{t('sim.measure')}</button
          >
          {#if measurements.length}
            <div class="scroll-x">
              <div class="table-scroll">
                <table class="data small">
                  <thead
                    ><tr
                      ><th>{t('sim.time')} ({unitT})</th><th
                        >{isMotion ? t('sim.distance') : t('sim.quantity')} ({unitA})</th
                      ><th></th></tr
                    ></thead
                  >
                  <tbody>
                    {#each measurements as m, i (i)}
                      <tr
                        ><td>{formatNumber(m.t, locale.current, { digits: 2 })}</td><td
                          >{formatNumber(m.value, locale.current, { digits: 3 })}</td
                        ><td class="muted">{m.label ?? ''}</td></tr
                      >
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {:else}
            <p class="muted small" style="margin:0">{t('sim.noMeasurement')}</p>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  {#if !compact}
    <div class="sim__graphs">
      {#if isMotion}
        <TimeGraph
          series={seriesPosition}
          currentT={time}
          xLabel="t (s)"
          yLabel={unitA}
          marks={clockMarks.map((m) => ({ t: m.t, label: m.label }))}
          title={motionConfig.scene === 'inclined_plane' ? t('sim.distance') : t('sim.height')}
        />
      {:else}
        <label class="small cluster"
          ><input type="checkbox" bind:checked={showTangent} /> {t('sim.tangent')}</label
        >
      {/if}
      <TimeGraph
        series={seriesVelocity}
        currentT={time}
        xLabel="t ({unitT})"
        yLabel={isMotion ? 'm/s' : `${unitA}/${unitT}`}
        title={isMotion ? t('sim.velocity') : t('sim.rate')}
      />
    </div>

    <details class="sim__table">
      <summary>{t('sim.table')}</summary>
      <div class="scroll-x">
        <div class="table-scroll">
          <table class="data small">
            <thead
              ><tr
                ><th>t ({unitT})</th><th
                  >{isMotion
                    ? motionConfig.scene === 'inclined_plane'
                      ? t('sim.distance')
                      : t('sim.height')
                    : t('sim.quantity')} ({unitA})</th
                ><th>{isMotion ? t('sim.velocity') : t('sim.rate')}</th></tr
              ></thead
            >
            <tbody>
              {#each tableRows as r (r.t)}
                <tr
                  ><td>{formatNumber(r.t, locale.current, { digits: 2 })}</td><td
                    >{formatNumber(r.a, locale.current, { digits: 3 })}</td
                  ><td>{formatNumber(r.b, locale.current, { digits: 3 })}</td></tr
                >
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </details>

    <details class="sim__model">
      <summary>{t('sim.model')}</summary>
      <ul>
        {#each LL(simulation.assumptions) as a (a)}<li>{a}</li>{/each}
      </ul>
      <p class="small"><strong>{t('sim.validity')}</strong> — {L(simulation.validity)}</p>
      <p class="small"><strong>{t('sim.method')}</strong> — {L(simulation.numericalMethod)}</p>
      <p class="small">
        <strong>{t('sim.ignored')}</strong> — {LL(simulation.ignoredEffects).join(' · ')}
      </p>
      <p class="small muted">{L(simulation.a11y)}</p>
    </details>
  {/if}
</div>

<style>
  .sim {
    display: grid;
    gap: var(--space-3);
  }
  .sim__grid {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: var(--space-3);
  }
  .sim > *,
  .sim__grid > *,
  .sim__graphs > * {
    min-width: 0;
  }
  .sim__transport {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    margin-top: var(--space-2);
  }
  .sim__speed,
  .sim__time {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .sim__time {
    flex: 1 1 12rem;
  }
  .sim__time input {
    flex: 1;
    min-width: 6rem;
  }
  .sim__controls {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    display: grid;
    gap: var(--space-2);
  }
  .sim__control {
    display: grid;
    gap: 0.2rem;
  }
  .sim__control input {
    width: 100%;
  }
  .sim__measure {
    margin-top: var(--space-3);
  }
  .sim__graphs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
    gap: var(--space-3);
  }
  .mono {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  input[type='range'] {
    min-height: 32px;
  }
  @media (max-width: 700px) {
    .sim__grid {
      grid-template-columns: 1fr;
    }
  }
</style>
