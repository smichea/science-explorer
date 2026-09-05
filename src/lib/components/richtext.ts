import DOMPurify from 'dompurify';
import katex from 'katex';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

const MATH_TOKEN = 'MATHCHUNK';

interface MathChunk {
  tex: string;
  display: boolean;
}

/** Extracts `$$…$$` and `$…$` before Markdown parsing so underscores and asterisks survive. */
function extractMath(source: string): { text: string; chunks: MathChunk[] } {
  const chunks: MathChunk[] = [];
  let text = source.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => {
    chunks.push({ tex: tex.trim(), display: true });
    return `${MATH_TOKEN}${chunks.length - 1}X`;
  });
  text = text.replace(/(^|[^\\$])\$([^$\n]+?)\$/g, (_, before: string, tex: string) => {
    chunks.push({ tex: tex.trim(), display: false });
    return `${before}${MATH_TOKEN}${chunks.length - 1}X`;
  });
  return { text, chunks };
}

function renderMath(chunk: MathChunk): string {
  try {
    return katex.renderToString(chunk.tex, {
      displayMode: chunk.display,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: 'ignore',
    });
  } catch {
    return `<code>${chunk.tex}</code>`;
  }
}

/** Markdown + LaTeX → sanitised HTML. Authored content only; learner free text is never rendered this way. */
export function renderRichText(source: string | undefined | null): string {
  if (!source) return '';
  const { text, chunks } = extractMath(source);
  const html = marked.parse(text, { async: false }) as string;
  const withMath = html.replace(/MATHCHUNK(\d+)X/g, (_, i: string) => renderMath(chunks[Number(i)]));
  return DOMPurify.sanitize(withMath, {
    USE_PROFILES: { html: true, mathMl: true, svg: true },
    ADD_ATTR: ['target', 'rel'],
  });
}

/** Inline formula rendering (no Markdown). */
export function renderTex(tex: string, display = false): string {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'htmlAndMathml', strict: 'ignore' });
  } catch {
    return tex;
  }
}
