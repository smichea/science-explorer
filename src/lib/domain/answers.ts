import type { ExerciseDefinition, Locale } from '../content-schema';
import { parseLocaleNumber } from './i18n/format';

export interface AnswerCheck {
  correct: boolean;
  /** 0..1 partial credit. */
  score: number;
  feedback:
    'correct' | 'incorrect' | 'partial' | 'unit_wrong' | 'parse_error' | 'reasoning_required';
}

const WRONG: AnswerCheck = { correct: false, score: 0, feedback: 'incorrect' };

// ---------------------------------------------------------------------------
// Numeric
// ---------------------------------------------------------------------------

function normaliseUnit(u: string): string {
  return u
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/·|\*/g, '.')
    .replace(/µ/g, 'u')
    .replace(/⁻¹/g, '^-1')
    .replace(/⁻²/g, '^-2')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\/\(([^)]+)\)/g, '/$1')
    .replace(/(m|s|l|mol)\.(s|l)\^-1/g, '$1/$2')
    .replace(/mol\/l\.s\^-1|mol\.l\^-1\.s\^-1|mol\/l\/s/g, 'mol/l.s')
    .replace(/m\.s\^-2/g, 'm/s^2')
    .replace(/m\.s\^-1/g, 'm/s');
}

export function unitsEquivalent(a: string | undefined, b: string | undefined): boolean {
  if (!a && !b) return true;
  return normaliseUnit(a ?? '') === normaliseUnit(b ?? '');
}

export function checkNumeric(
  exercise: ExerciseDefinition,
  input: { value: string; unit?: string },
  _locale: Locale
): AnswerCheck {
  const spec = exercise.numeric;
  if (!spec) return WRONG;
  const value = parseLocaleNumber(input.value);
  if (!Number.isFinite(value)) return { correct: false, score: 0, feedback: 'parse_error' };
  const tolerance =
    spec.tolerance.kind === 'relative'
      ? Math.abs(spec.value) * spec.tolerance.value
      : spec.tolerance.value;
  const valueOk = Math.abs(value - spec.value) <= tolerance + 1e-12;
  if (!valueOk) return WRONG;
  if (
    spec.unit &&
    input.unit !== undefined &&
    input.unit.trim() !== '' &&
    !unitsEquivalent(spec.unit, input.unit)
  ) {
    return { correct: false, score: 0.5, feedback: 'unit_wrong' };
  }
  return { correct: true, score: 1, feedback: 'correct' };
}

// ---------------------------------------------------------------------------
// Choice
// ---------------------------------------------------------------------------

export function checkChoice(
  exercise: ExerciseDefinition,
  selected: string[],
  reasoning = ''
): AnswerCheck {
  const spec = exercise.choice;
  if (!spec) return WRONG;
  if (spec.requireReasoning && reasoning.trim().length < 5)
    return { correct: false, score: 0, feedback: 'reasoning_required' };
  const correct = new Set(spec.choices.filter((c) => c.correct).map((c) => c.id));
  const chosen = new Set(selected);
  if (!spec.multiple) {
    const ok = chosen.size === 1 && correct.has([...chosen][0]);
    return ok ? { correct: true, score: 1, feedback: 'correct' } : WRONG;
  }
  const intersection = [...chosen].filter((c) => correct.has(c)).length;
  const union = new Set([...chosen, ...correct]).size;
  const score = union === 0 ? 0 : intersection / union;
  if (score >= 0.999) return { correct: true, score: 1, feedback: 'correct' };
  if (score > 0) return { correct: false, score, feedback: 'partial' };
  return WRONG;
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

export function checkOrdering(exercise: ExerciseDefinition, order: string[]): AnswerCheck {
  const spec = exercise.ordering;
  if (!spec) return WRONG;
  const expected = spec.correctOrder;
  if (order.length !== expected.length) return WRONG;
  let exact = true;
  let pairs = 0;
  for (let i = 0; i < expected.length; i++) if (order[i] !== expected[i]) exact = false;
  for (let i = 0; i < expected.length - 1; i++)
    if (order.indexOf(expected[i]) < order.indexOf(expected[i + 1])) pairs++;
  if (exact) return { correct: true, score: 1, feedback: 'correct' };
  const score = pairs / Math.max(1, expected.length - 1);
  return score > 0.5 ? { correct: false, score: score * 0.6, feedback: 'partial' } : WRONG;
}

// ---------------------------------------------------------------------------
// Symbolic: tiny recursive-descent parser + numeric equivalence on sample points
// ---------------------------------------------------------------------------

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'id'; name: string }
  | { kind: 'op'; op: string }
  | { kind: 'lp' }
  | { kind: 'rp' };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const s = src
    .replace(/,/g, '.')
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\s+/g, '');
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      if (s[j] === 'e' && /[0-9-]/.test(s[j + 1] ?? '')) {
        j++;
        if (s[j] === '-') j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      tokens.push({ kind: 'num', value: Number(s.slice(i, j)) });
      i = j;
    } else if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      const word = s.slice(i, j);
      const known = ['exp', 'ln', 'log', 'sqrt', 'sin', 'cos', 'tan', 'pi'];
      if (known.includes(word)) tokens.push({ kind: 'id', name: word });
      else for (const ch of word) tokens.push({ kind: 'id', name: ch });
      i = j;
    } else if ('+-*/^'.includes(c)) {
      tokens.push({ kind: 'op', op: c });
      i++;
    } else if (c === '(') {
      tokens.push({ kind: 'lp' });
      i++;
    } else if (c === ')') {
      tokens.push({ kind: 'rp' });
      i++;
    } else throw new Error(`unexpected character ${c}`);
  }
  return tokens;
}

type Expr = (env: Record<string, number>) => number;

const FUNCTIONS: Record<string, (x: number) => number> = {
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
};

function parse(tokens: Token[], variables: string[]): Expr {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function primary(): Expr {
    const tok = next();
    if (!tok) throw new Error('unexpected end');
    if (tok.kind === 'num') return () => tok.value;
    if (tok.kind === 'lp') {
      const e = expression();
      if (next()?.kind !== 'rp') throw new Error('missing )');
      return e;
    }
    if (tok.kind === 'op' && tok.op === '-') {
      const e = unary();
      return (env) => -e(env);
    }
    if (tok.kind === 'op' && tok.op === '+') return unary();
    if (tok.kind === 'id') {
      if (tok.name === 'pi') return () => Math.PI;
      if (tok.name === 'e') return () => Math.E;
      if (FUNCTIONS[tok.name]) {
        const fn = FUNCTIONS[tok.name];
        const arg = peek()?.kind === 'lp' ? primary() : unary();
        return (env) => fn(arg(env));
      }
      if (!variables.includes(tok.name)) throw new Error(`unknown symbol ${tok.name}`);
      return (env) => env[tok.name];
    }
    throw new Error('unexpected token');
  }

  function power(): Expr {
    const base = primary();
    if (peek()?.kind === 'op' && (peek() as { op: string }).op === '^') {
      next();
      const exponent = unary();
      return (env) => Math.pow(base(env), exponent(env));
    }
    return base;
  }

  function unary(): Expr {
    return power();
  }

  /** Implicit multiplication: 6t, 2(3t+1), t(t+1). */
  function implicit(): Expr {
    let left = unary();
    for (;;) {
      const tok = peek();
      if (!tok) break;
      const starts = tok.kind === 'num' || tok.kind === 'id' || tok.kind === 'lp';
      if (!starts) break;
      const right = unary();
      const l = left;
      left = (env) => l(env) * right(env);
    }
    return left;
  }

  function term(): Expr {
    let left = implicit();
    for (;;) {
      const tok = peek();
      if (tok?.kind === 'op' && (tok.op === '*' || tok.op === '/')) {
        next();
        const right = implicit();
        const l = left;
        left = tok.op === '*' ? (env) => l(env) * right(env) : (env) => l(env) / right(env);
      } else break;
    }
    return left;
  }

  function expression(): Expr {
    let left = term();
    for (;;) {
      const tok = peek();
      if (tok?.kind === 'op' && (tok.op === '+' || tok.op === '-')) {
        next();
        const right = term();
        const l = left;
        left = tok.op === '+' ? (env) => l(env) + right(env) : (env) => l(env) - right(env);
      } else break;
    }
    return left;
  }

  const result = expression();
  if (pos !== tokens.length) throw new Error('trailing tokens');
  return result;
}

export function compileExpression(source: string, variables: string[]): Expr {
  return parse(tokenize(source), variables);
}

const SAMPLE_POINTS = [-2.3, -1.1, -0.4, 0.37, 0.9, 1.7, 2.6];

export function expressionsEquivalent(a: string, b: string, variable: string): boolean {
  let fa: Expr;
  let fb: Expr;
  try {
    fa = compileExpression(a, [variable]);
    fb = compileExpression(b, [variable]);
  } catch {
    return false;
  }
  let compared = 0;
  for (const x of SAMPLE_POINTS) {
    const va = fa({ [variable]: x });
    const vb = fb({ [variable]: x });
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    compared++;
    const scale = Math.max(1, Math.abs(va), Math.abs(vb));
    if (Math.abs(va - vb) > 1e-6 * scale) return false;
  }
  return compared >= 4;
}

export function checkSymbolic(exercise: ExerciseDefinition, input: string): AnswerCheck {
  const spec = exercise.symbolic;
  if (!spec) return WRONG;
  try {
    compileExpression(input, [spec.variable]);
  } catch {
    return { correct: false, score: 0, feedback: 'parse_error' };
  }
  const ok = spec.accepted.some((accepted) =>
    expressionsEquivalent(input, accepted, spec.variable)
  );
  return ok ? { correct: true, score: 1, feedback: 'correct' } : WRONG;
}
