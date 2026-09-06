<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { evaluateScalar, type ToolState } from '$lib/domain/lesson';
  import { criticalAngle, lensImage, refractionAngle } from '$lib/domain/lessonTools';
  import { locale, t } from '$lib/state/locale.svelte';
  import { fmt } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'optics' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
  }
  let { tool, tstate }: Props = $props();

  const W = 560;
  const H = 360;
  const f = (v: number, d = 1) => fmt(v, locale.current, d);
  const RAD = Math.PI / 180;

  // --- refraction -----------------------------------------------------------
  const n1 = $derived(Math.max(1, evaluateScalar(tool.n1, tstate.params)));
  const n2 = $derived(Math.max(1, evaluateScalar(tool.n2, tstate.params)));
  const incidence = $derived(
    Math.max(0, Math.min(89.9, evaluateScalar(tool.angle, tstate.params)))
  );
  const refracted = $derived(refractionAngle(n1, n2, incidence));
  const critical = $derived(criticalAngle(n1, n2));
  const cx = W / 2;
  const cy = H / 2;
  const R = 150;
  const incident = $derived({
    x: cx - R * Math.sin(incidence * RAD),
    y: cy - R * Math.cos(incidence * RAD),
  });
  const reflected = $derived({
    x: cx + R * Math.sin(incidence * RAD),
    y: cy - R * Math.cos(incidence * RAD),
  });
  const exit = $derived(
    refracted === null
      ? null
      : { x: cx + R * Math.sin(refracted * RAD), y: cy + R * Math.cos(refracted * RAD) }
  );
  /** An arc between two angles (degrees from the upward normal, clockwise), around the point of incidence. */
  function arc(from: number, to: number, r: number, below = false): string {
    const p = (a: number) =>
      `${cx + (below ? 1 : -1) * r * Math.sin(a * RAD) * (below ? 1 : 1)},${cy + (below ? r * Math.cos(a * RAD) : -r * Math.cos(a * RAD))}`;
    return `M${p(from)} A${r},${r} 0 0 ${below ? 0 : 1} ${p(to)}`;
  }

  // --- lens -----------------------------------------------------------------
  const focal = $derived(Math.max(0.5, evaluateScalar(tool.focal, tstate.params)));
  const distance = $derived(Math.max(0.1, evaluateScalar(tool.object.distance, tstate.params)));
  const height = $derived(evaluateScalar(tool.object.height, tstate.params));
  const image = $derived(lensImage(focal, distance, height));
  const lensX = W * 0.5;
  const axisY = H * 0.55;
  /** Centimetres → pixels, so that the object, both foci and the image fit. */
  const k = $derived.by(() => {
    const left = Math.max(distance, focal) + focal * 0.3;
    const right = Math.max(
      2 * focal,
      image.atInfinity ? 3 * focal : Math.min(Math.abs(image.position), 6 * focal) + focal * 0.3
    );
    return Math.min(
      (lensX - 30) / left,
      (W - lensX - 30) / right,
      (H * 0.4) /
        Math.max(Math.abs(height), Math.min(Math.abs(image.height), 4 * Math.abs(height)), 1)
    );
  });
  const px = (xcm: number) => lensX + xcm * k;
  const py = (ycm: number) => axisY - ycm * k;
  const imageDrawn = $derived(!image.atInfinity && Math.abs(image.position) < 6 * focal);
  const imageX = $derived(imageDrawn ? image.position : Math.sign(image.position || 1) * 6 * focal);
  const imageH = $derived(imageDrawn ? image.height : 0);
</script>

<div class="tool stack-sm" data-testid="optics-tool" data-mode={tool.mode}>
  {#if tool.mode === 'refraction'}
    <svg viewBox="0 0 {W} {H}" class="tool__svg" role="img" aria-label={t('lesson.tool.optics')}>
      <rect x="0" y="0" width={W} height={cy} fill="rgba(255,255,255,0.03)" />
      <rect
        x="0"
        y={cy}
        width={W}
        height={H - cy}
        fill="rgba(127,156,255,{Math.min(0.5, 0.08 + (n2 - 1) * 0.35)})"
      />
      <line x1="0" y1={cy} x2={W} y2={cy} stroke="#eef1f8" stroke-width="1.5" />
      <line x1={cx} y1="20" x2={cx} y2={H - 20} stroke="#a7b0c8" stroke-dasharray="5 4" />
      <text x="16" y="24" class="note">n₁ = {f(n1, 2)}</text>
      <text x="16" y={H - 12} class="note">n₂ = {f(n2, 2)}</text>
      <!-- incident ray -->
      <line x1={incident.x} y1={incident.y} x2={cx} y2={cy} stroke="#ffd166" stroke-width="2.5" />
      <path d={arc(0, incidence, 40)} fill="none" stroke="#ffd166" stroke-width="1.5" />
      <text
        x={cx - 46 * Math.sin((incidence / 2) * RAD) - 22}
        y={cy - 46 * Math.cos((incidence / 2) * RAD)}
        class="note"
        fill="#ffd166">i₁ = {f(incidence)}°</text
      >
      <!-- reflected ray (dim), refracted ray or total reflection -->
      <line
        x1={cx}
        y1={cy}
        x2={reflected.x}
        y2={reflected.y}
        stroke="#ffd166"
        stroke-width={refracted === null ? 2.5 : 1}
        opacity={refracted === null ? 1 : 0.35}
      />
      {#if exit && refracted !== null}
        <line x1={cx} y1={cy} x2={exit.x} y2={exit.y} stroke="#5ee6a8" stroke-width="2.5" />
        <path d={arc(0, refracted, 40, true)} fill="none" stroke="#5ee6a8" stroke-width="1.5" />
        <text
          x={cx + 46 * Math.sin((refracted / 2) * RAD) + 4}
          y={cy + 46 * Math.cos((refracted / 2) * RAD) + 6}
          class="note"
          fill="#5ee6a8">i₂ = {f(refracted)}°</text
        >
      {:else}
        <text x={cx + 12} y={cy + 24} class="note" fill="#ff8fab"
          >{t('lesson.optics.totalReflection')}</text
        >
      {/if}
    </svg>
    <p class="small" style="margin: 0" data-testid="optics-reading">
      n₁ sin i₁ = n₂ sin i₂ · {t('lesson.optics.incidence')}
      {f(incidence)}° ·
      {t('lesson.optics.refraction')}
      {refracted === null ? t('lesson.optics.totalReflection') : `${f(refracted)}°`} ·
      {t('lesson.optics.critical')}
      {critical === null ? t('lesson.optics.none') : `${f(critical)}°`}
    </p>
  {:else}
    <svg viewBox="0 0 {W} {H}" class="tool__svg" role="img" aria-label={t('lesson.tool.optics')}>
      <line x1="0" y1={axisY} x2={W} y2={axisY} stroke="#a7b0c8" />
      <!-- the lens -->
      <line
        x1={lensX}
        y1={axisY - H * 0.42}
        x2={lensX}
        y2={axisY + H * 0.42}
        stroke="#7f9cff"
        stroke-width="3"
      />
      <polygon
        points="{lensX - 7},{axisY - H * 0.42 + 12} {lensX},{axisY - H * 0.42} {lensX + 7},{axisY -
          H * 0.42 +
          12}"
        fill="#7f9cff"
      />
      <polygon
        points="{lensX - 7},{axisY + H * 0.42 - 12} {lensX},{axisY + H * 0.42} {lensX + 7},{axisY +
          H * 0.42 -
          12}"
        fill="#7f9cff"
      />
      <text x={lensX + 6} y={axisY + 14} class="note">O</text>
      <!-- foci -->
      <circle cx={px(-focal)} cy={axisY} r="3.5" fill="#fff" />
      <text x={px(-focal) - 4} y={axisY + 16} class="note">F</text>
      <circle cx={px(focal)} cy={axisY} r="3.5" fill="#fff" />
      <text x={px(focal) - 4} y={axisY + 16} class="note">F'</text>
      <!-- object -->
      <line
        x1={px(-distance)}
        y1={axisY}
        x2={px(-distance)}
        y2={py(height)}
        stroke="#ffd166"
        stroke-width="3"
      />
      <polygon
        points="{px(-distance) - 6},{py(height) + (height >= 0 ? 10 : -10)} {px(-distance)},{py(
          height
        )} {px(-distance) + 6},{py(height) + (height >= 0 ? 10 : -10)}"
        fill="#ffd166"
      />
      <text x={px(-distance) - 10} y={py(height) - 8} class="note" fill="#ffd166">A B</text>
      <!-- rays: parallel then through F', and through the centre -->
      <line
        x1={px(-distance)}
        y1={py(height)}
        x2={lensX}
        y2={py(height)}
        stroke="#f7f1e3"
        stroke-width="1.3"
      />
      {#if image.atInfinity}
        <line
          x1={lensX}
          y1={py(height)}
          x2={W}
          y2={py(height) + ((W - lensX) * (height * k)) / (focal * k)}
          stroke="#f7f1e3"
          stroke-width="1.3"
        />
        <line
          x1={px(-distance)}
          y1={py(height)}
          x2={W}
          y2={axisY + (axisY - py(height)) * ((W - lensX) / (lensX - px(-distance)))}
          stroke="#f7f1e3"
          stroke-width="1.3"
        />
      {:else}
        <line
          x1={lensX}
          y1={py(height)}
          x2={px(imageX)}
          y2={py(imageH)}
          stroke="#f7f1e3"
          stroke-width="1.3"
          stroke-dasharray={image.real ? undefined : '5 4'}
        />
        <line
          x1={px(-distance)}
          y1={py(height)}
          x2={px(imageX)}
          y2={py(imageH)}
          stroke="#f7f1e3"
          stroke-width="1.3"
          stroke-dasharray={image.real ? undefined : '5 4'}
        />
        {#if image.real}
          <line
            x1={lensX}
            y1={py(height)}
            x2={px(Math.min(imageX, 6 * focal))}
            y2={py(imageH)}
            stroke="#f7f1e3"
            stroke-width="1.3"
          />
        {/if}
        {#if imageDrawn}
          <line
            x1={px(image.position)}
            y1={axisY}
            x2={px(image.position)}
            y2={py(image.height)}
            stroke="#5ee6a8"
            stroke-width="3"
            stroke-dasharray={image.real ? undefined : '5 4'}
          />
          <text x={px(image.position) + 8} y={py(image.height) - 6} class="note" fill="#5ee6a8"
            >A' B'</text
          >
        {/if}
      {/if}
    </svg>
    <p class="small" style="margin: 0" data-testid="optics-reading">
      f' = {f(focal)} cm · OA = −{f(distance)} cm · AB = {f(height)} cm ·
      {#if image.atInfinity}{t('lesson.optics.image')} {t('lesson.optics.infinity')}{:else}
        OA' = {f(image.position)} cm · A'B' = {f(image.height)} cm ·
        {t('lesson.optics.magnification')} γ = {f(image.magnification, 2)} ·
        {t('lesson.optics.image')}
        {image.real ? t('lesson.optics.real') : t('lesson.optics.virtual')}{/if}
    </p>
  {/if}
</div>

<style>
  .tool__svg {
    width: 100%;
    height: auto;
    display: block;
    border-radius: var(--radius);
    background: #070b17;
  }
  .note {
    font-size: 13px;
    fill: #eef1f8;
    font-family: var(--font-body);
    font-weight: 600;
    paint-order: stroke;
    stroke: #070b17;
    stroke-width: 3px;
    stroke-linejoin: round;
  }
</style>
