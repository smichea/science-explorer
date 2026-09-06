<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { LessonTool } from '$lib/content-schema';
  import { evaluateScalar, type ToolState } from '$lib/domain/lesson';
  import { waveDisplacement, waveQuantities } from '$lib/domain/lessonTools';
  import { locale, t } from '$lib/state/locale.svelte';
  import { prefs } from '$lib/state/prefs.svelte';
  import { fmt, scales } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'wave' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
    interactive?: boolean;
  }
  let { tool, tstate, interactive = false }: Props = $props();

  const wave = $derived.by(() => {
    const period = evaluateScalar(tool.period, tstate.params);
    const wavelength =
      tool.wavelength !== undefined ? evaluateScalar(tool.wavelength, tstate.params) : undefined;
    const speed = tool.speed !== undefined ? evaluateScalar(tool.speed, tstate.params) : undefined;
    const q = waveQuantities({ period: period > 0 ? period : 1, wavelength, speed });
    return { amplitude: tool.amplitude, ...q };
  });
  let time = $state(0);
  let playing = $state(false);
  let point = $state(0);
  $effect(() => {
    if (!interactive) point = tool.point;
  });
  let frame = 0;
  let last = 0;
  function tick(now: number) {
    if (!playing) return;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    // Slow motion: one real second is a quarter of a period, so that the wave is watchable.
    time = (time + (dt * wave.period) / 4) % (wave.period * 12);
    frame = requestAnimationFrame(tick);
  }
  function play() {
    if (playing) {
      playing = false;
      cancelAnimationFrame(frame);
      return;
    }
    playing = true;
    last = 0;
    frame = requestAnimationFrame(tick);
  }
  onDestroy(() => cancelAnimationFrame(frame));
  $effect(() => {
    // The animation starts by itself unless the learner prefers reduced motion.
    if (!prefs.reducedMotion && !playing && time === 0) play();
  });

  const top = $derived(
    scales(
      { x: [0, tool.length], y: [-tool.amplitude * 1.3, tool.amplitude * 1.3] },
      { W: 560, H: 200, pad: { l: 46, r: 18, t: 14, b: 30 } }
    )
  );
  const window_ = $derived(wave.period * 3);
  const bottom = $derived(
    scales(
      { x: [0, window_], y: [-tool.amplitude * 1.3, tool.amplitude * 1.3] },
      { W: 560, H: 170, pad: { l: 46, r: 18, t: 14, b: 30 } }
    )
  );
  const stringPath = $derived.by(() => {
    let d = '';
    for (let i = 0; i <= 240; i++) {
      const x = (tool.length * i) / 240;
      const y = waveDisplacement(x, time, wave);
      d += `${i ? 'L' : 'M'}${top.sx(x).toFixed(1)} ${top.sy(y).toFixed(1)} `;
    }
    return d;
  });
  const signalPath = $derived.by(() => {
    let d = '';
    const t0 = Math.max(0, time - window_);
    for (let i = 0; i <= 240; i++) {
      const tt = t0 + ((time - t0) * i) / 240;
      const y = waveDisplacement(point, tt, wave);
      d += `${i ? 'L' : 'M'}${bottom.sx(tt - t0).toFixed(1)} ${bottom.sy(y).toFixed(1)} `;
    }
    return d;
  });
  const delay = $derived(point / wave.speed);
  const f = (v: number) => fmt(v, locale.current, 3);
</script>

<div class="tool stack-sm" data-testid="wave-tool" data-playing={playing}>
  <svg
    viewBox="0 0 {top.W} {top.H}"
    class="tool__svg"
    role="img"
    aria-label={t('lesson.tool.wave')}
  >
    {#each top.xTicks as v (v)}
      <line x1={top.sx(v)} y1={top.pad.t} x2={top.sx(v)} y2={top.H - top.pad.b} class="grid" />
      <text x={top.sx(v)} y={top.H - top.pad.b + 14} class="tick" text-anchor="middle"
        >{fmt(v, locale.current)}</text
      >
    {/each}
    <line x1={top.pad.l} y1={top.sy(0)} x2={top.W - top.pad.r} y2={top.sy(0)} class="axis" />
    <text x={top.W - top.pad.r} y={top.H - 4} class="label" text-anchor="end">{tool.labels.x}</text>
    <path d={stringPath} fill="none" stroke="#7f9cff" stroke-width="2.4" />
    <line
      x1={top.sx(point)}
      y1={top.pad.t}
      x2={top.sx(point)}
      y2={top.H - top.pad.b}
      stroke="#ffd166"
      stroke-dasharray="4 4"
    />
    <circle
      cx={top.sx(point)}
      cy={top.sy(waveDisplacement(point, time, wave))}
      r="5"
      fill="#ffd166"
      stroke="#0b1020"
    />
    <text x={top.sx(point) + 8} y={top.pad.t + 12} class="note" fill="#ffd166">M</text>
    <!-- one wavelength, measured from the source -->
    <line
      x1={top.sx(0)}
      y1={top.pad.t + 6}
      x2={top.sx(Math.min(tool.length, wave.wavelength))}
      y2={top.pad.t + 6}
      stroke="#5ee6a8"
      stroke-width="2"
    />
    <text
      x={top.sx(Math.min(tool.length, wave.wavelength) / 2)}
      y={top.pad.t + 18}
      class="note"
      fill="#5ee6a8"
      text-anchor="middle">λ = {f(wave.wavelength)} m</text
    >
  </svg>
  <svg
    viewBox="0 0 {bottom.W} {bottom.H}"
    class="tool__svg"
    role="img"
    aria-label="{t('lesson.wave.signal')} M"
  >
    {#each bottom.xTicks as v (v)}
      <line
        x1={bottom.sx(v)}
        y1={bottom.pad.t}
        x2={bottom.sx(v)}
        y2={bottom.H - bottom.pad.b}
        class="grid"
      />
      <text x={bottom.sx(v)} y={bottom.H - bottom.pad.b + 14} class="tick" text-anchor="middle"
        >{fmt(v, locale.current)}</text
      >
    {/each}
    <line
      x1={bottom.pad.l}
      y1={bottom.sy(0)}
      x2={bottom.W - bottom.pad.r}
      y2={bottom.sy(0)}
      class="axis"
    />
    <text x={bottom.W - bottom.pad.r} y={bottom.H - 4} class="label" text-anchor="end"
      >{tool.labels.t}</text
    >
    <text x={bottom.pad.l + 4} y={bottom.pad.t - 2} class="label">{t('lesson.wave.signal')} M</text>
    <path d={signalPath} fill="none" stroke="#ffd166" stroke-width="2" />
  </svg>
  <p class="small" style="margin: 0" data-testid="wave-reading">
    {t('lesson.wave.period')} T = {f(wave.period)} s · {t('lesson.wave.frequency')} f = {f(
      wave.frequency
    )} Hz ·
    {t('lesson.wave.wavelength')} λ = {f(wave.wavelength)} m · {t('lesson.wave.speed')} v = {f(
      wave.speed
    )} m/s ·
    {t('lesson.wave.delay')} τ = {f(delay)} s · t = {f(time)} s
  </p>
  <div class="cluster">
    <button class="btn btn--sm" type="button" onclick={play} data-testid="wave-play"
      >{playing ? `⏸ ${t('lesson.wave.pause')}` : `▶ ${t('lesson.wave.play')}`}</button
    >
    <label class="field" style="flex: 1">
      <span class="label">{t('lesson.wave.time')} : {f(time)} s</span>
      <input
        type="range"
        min="0"
        max={wave.period * 12}
        step={wave.period / 40}
        bind:value={time}
        oninput={() => {
          if (playing) play();
        }}
      />
    </label>
    {#if interactive}
      <label class="field" style="flex: 1">
        <span class="label">{t('lesson.wave.point')} : {f(point)} m</span>
        <input
          type="range"
          min="0"
          max={tool.length}
          step={tool.length / 80}
          bind:value={point}
          data-testid="wave-point"
        />
      </label>
    {/if}
  </div>
</div>

<style>
  .tool__svg {
    width: 100%;
    height: auto;
    display: block;
    border-radius: var(--radius);
    background: #070b17;
  }
  .grid {
    stroke: rgba(255, 255, 255, 0.08);
  }
  .axis {
    stroke: rgba(255, 255, 255, 0.45);
    stroke-width: 1.2;
  }
  .tick {
    font-size: 11px;
    fill: #a7b0c8;
    font-family: var(--font-body);
  }
  .label {
    font-size: 12px;
    fill: #d5dcf0;
    font-family: var(--font-body);
    font-weight: 600;
  }
  .note {
    font-size: 12px;
    font-family: var(--font-body);
    font-weight: 600;
    paint-order: stroke;
    stroke: #070b17;
    stroke-width: 3px;
  }
</style>
