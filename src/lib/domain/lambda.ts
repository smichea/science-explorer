/** Pure untyped lambda calculus. Identity is structural, never a printed variable name. */
export type LambdaTerm =
  | { kind: 'var'; id: number; name: string }
  | { kind: 'lam'; id: number; name: string; body: LambdaTerm }
  | { kind: 'app'; id: number; fun: LambdaTerm; arg: LambdaTerm };
export type LambdaStrategy = 'normal' | 'applicative';
export const LAMBDA_LIMITS = {
  chars: 3000,
  size: 500,
  depth: 100,
  graphNodes: 100,
  graphEdges: 400,
};
let serial = 0;
const id = () => ++serial;

export class LambdaError extends Error {
  constructor(
    public code: 'syntax' | 'size' | 'depth' | 'redex',
    public position = 0
  ) {
    super(code);
  }
}

/** λ or backslash, several parameters, left-associated application; no eval or macros. */
export function parseLambda(source: string): LambdaTerm {
  if (source.length > LAMBDA_LIMITS.chars) throw new LambdaError('size');
  const tokens: { text: string; at: number }[] = [];
  const re = /\s+|[λ\\().]|[A-Za-z_][A-Za-z_0-9']*/gy;
  let at = 0;
  while (at < source.length) {
    re.lastIndex = at;
    const m = re.exec(source);
    if (!m) throw new LambdaError('syntax', at);
    if (!/^\s+$/.test(m[0])) tokens.push({ text: m[0], at });
    at = re.lastIndex;
  }
  let cursor = 0;
  let nodes = 0;
  const token = () => tokens[cursor]?.text;
  const fail = (): never => {
    throw new LambdaError('syntax', tokens[cursor]?.at ?? source.length);
  };
  const make = <T extends LambdaTerm>(term: T): T => {
    if (++nodes > LAMBDA_LIMITS.size) throw new LambdaError('size');
    return term;
  };
  function expression(depth: number): LambdaTerm {
    if (depth > LAMBDA_LIMITS.depth) throw new LambdaError('depth');
    if (token() === 'λ' || token() === '\\') {
      cursor++;
      const names: string[] = [];
      while (token() && /^[A-Za-z_]/.test(token())) names.push(tokens[cursor++].text);
      if (!names.length || token() !== '.') fail();
      if (depth + names.length > LAMBDA_LIMITS.depth) throw new LambdaError('depth');
      cursor++;
      let body = expression(depth + names.length);
      for (const name of names.reverse()) body = make({ kind: 'lam', id: id(), name, body });
      return body;
    }
    let term = atom(depth + 1);
    while (token() && token() !== ')' && token() !== '.') {
      const arg = token() === 'λ' || token() === '\\' ? expression(depth + 1) : atom(depth + 1);
      term = make({ kind: 'app', id: id(), fun: term, arg });
    }
    return term;
  }
  function atom(depth: number): LambdaTerm {
    if (depth > LAMBDA_LIMITS.depth) throw new LambdaError('depth');
    if (token() === '(') {
      cursor++;
      const term = expression(depth + 1);
      if (token() !== ')') fail();
      cursor++;
      return term;
    }
    if (!token() || !/^[A-Za-z_]/.test(token())) fail();
    return make({ kind: 'var', id: id(), name: tokens[cursor++].text });
  }
  const term = expression(0);
  if (cursor !== tokens.length) fail();
  if (lambdaDepth(term) > LAMBDA_LIMITS.depth) throw new LambdaError('depth');
  return term;
}

export function printLambda(t: LambdaTerm, context = 0): string {
  if (t.kind === 'var') return t.name;
  const precedence = t.kind === 'lam' ? 0 : 1;
  const text =
    t.kind === 'lam'
      ? `λ${t.name}. ${printLambda(t.body)}`
      : `${printLambda(t.fun, 1)} ${printLambda(t.arg, 2)}`;
  return precedence < context ? `(${text})` : text;
}
export function lambdaSize(t: LambdaTerm): number {
  return t.kind === 'var'
    ? 1
    : t.kind === 'lam'
      ? 1 + lambdaSize(t.body)
      : 1 + lambdaSize(t.fun) + lambdaSize(t.arg);
}
export function lambdaDepth(t: LambdaTerm): number {
  return t.kind === 'var'
    ? 1
    : t.kind === 'lam'
      ? 1 + lambdaDepth(t.body)
      : 1 + Math.max(lambdaDepth(t.fun), lambdaDepth(t.arg));
}
export function freeLambda(t: LambdaTerm): Set<string> {
  if (t.kind === 'var') return new Set([t.name]);
  if (t.kind === 'lam') {
    const s = freeLambda(t.body);
    s.delete(t.name);
    return s;
  }
  return new Set([...freeLambda(t.fun), ...freeLambda(t.arg)]);
}
export function freeOccurrences(t: LambdaTerm, name: string): number {
  if (t.kind === 'var') return Number(t.name === name);
  if (t.kind === 'lam') return t.name === name ? 0 : freeOccurrences(t.body, name);
  return freeOccurrences(t.fun, name) + freeOccurrences(t.arg, name);
}
/** De Bruijn indices for bound names, explicit names for free variables. */
export function alphaKey(t: LambdaTerm, env: string[] = []): string {
  if (t.kind === 'var') {
    const index = env.lastIndexOf(t.name);
    return index < 0 ? `f:${t.name};` : `b:${env.length - index - 1};`;
  }
  if (t.kind === 'lam') return `λ(${alphaKey(t.body, [...env, t.name])})`;
  return `(${alphaKey(t.fun, env)} ${alphaKey(t.arg, env)})`;
}
export function lambdaAt(t: LambdaTerm, path: string): LambdaTerm {
  if (!path) return t;
  const head = path[0];
  if (head === 'b' && t.kind === 'lam') return lambdaAt(t.body, path.slice(1));
  if (t.kind === 'app' && (head === 'f' || head === 'a'))
    return lambdaAt(head === 'f' ? t.fun : t.arg, path.slice(1));
  throw new LambdaError('redex');
}
export function redexPaths(
  t: LambdaTerm,
  strategy: LambdaStrategy = 'normal',
  path = ''
): string[] {
  if (t.kind === 'var') return [];
  if (t.kind === 'lam') return redexPaths(t.body, strategy, path + 'b');
  const here = t.fun.kind === 'lam' ? [path] : [];
  const children = [
    ...redexPaths(t.fun, strategy, path + 'f'),
    ...redexPaths(t.arg, strategy, path + 'a'),
  ];
  return strategy === 'normal' ? [...here, ...children] : [...children, ...here];
}

export interface LambdaReduction {
  before: LambdaTerm;
  after: LambdaTerm;
  path: string;
  count: number;
  /** Each copied AST node points to its old argument node for the drawing animation. */
  origins: Map<number, number>;
  renamed: { from: string; to: string }[];
}
export function reduceLambda(before: LambdaTerm, path: string): LambdaReduction {
  const redex = lambdaAt(before, path);
  if (redex.kind !== 'app' || redex.fun.kind !== 'lam') throw new LambdaError('redex');
  const binder = redex.fun;
  const count = freeOccurrences(binder.body, binder.name);
  const predictedSize =
    lambdaSize(before) -
    lambdaSize(redex) +
    lambdaSize(binder.body) +
    count * (lambdaSize(redex.arg) - 1);
  if (predictedSize > LAMBDA_LIMITS.size) throw new LambdaError('size');
  const origins = new Map<number, number>();
  const renamed: LambdaReduction['renamed'] = [];
  const names = new Set<string>();
  const collect = (t: LambdaTerm) => {
    if (t.kind !== 'app') names.add(t.name);
    if (t.kind === 'lam') collect(t.body);
    if (t.kind === 'app') {
      collect(t.fun);
      collect(t.arg);
    }
  };
  collect(before);
  const fresh = (name: string) => {
    let next = name + "'";
    while (names.has(next)) next += "'";
    names.add(next);
    return next;
  };
  const clone = (t: LambdaTerm): LambdaTerm => {
    const next = id();
    origins.set(next, t.id);
    if (t.kind === 'var') return { ...t, id: next };
    if (t.kind === 'lam') return { ...t, id: next, body: clone(t.body) };
    return { ...t, id: next, fun: clone(t.fun), arg: clone(t.arg) };
  };
  const rename = (t: LambdaTerm, from: string, to: string): LambdaTerm => {
    if (t.kind === 'var') return t.name === from ? { ...t, name: to } : t;
    if (t.kind === 'lam') return t.name === from ? t : { ...t, body: rename(t.body, from, to) };
    return { ...t, fun: rename(t.fun, from, to), arg: rename(t.arg, from, to) };
  };
  const argFree = freeLambda(redex.arg);
  const substitute = (t: LambdaTerm): LambdaTerm => {
    if (t.kind === 'var') return t.name === binder.name ? clone(redex.arg) : t;
    if (t.kind === 'app') return { ...t, fun: substitute(t.fun), arg: substitute(t.arg) };
    if (t.name === binder.name || !freeOccurrences(t.body, binder.name)) return t;
    if (argFree.has(t.name)) {
      const name = fresh(t.name);
      renamed.push({ from: t.name, to: name });
      return { ...t, name, body: substitute(rename(t.body, t.name, name)) };
    }
    return { ...t, body: substitute(t.body) };
  };
  const replace = (t: LambdaTerm, rest: string): LambdaTerm => {
    if (!rest) return substitute(binder.body);
    if (t.kind === 'lam') return { ...t, body: replace(t.body, rest.slice(1)) };
    if (t.kind !== 'app') throw new LambdaError('redex');
    return rest[0] === 'f'
      ? { ...t, fun: replace(t.fun, rest.slice(1)) }
      : { ...t, arg: replace(t.arg, rest.slice(1)) };
  };
  const after = replace(before, path);
  if (lambdaDepth(after) > LAMBDA_LIMITS.depth) throw new LambdaError('depth');
  return { before, after, path, count, origins, renamed };
}

export interface ReductionNode {
  id: number;
  term: LambdaTerm;
  key: string;
  depth: number;
  size: number;
  normal: boolean;
  frontier: boolean;
}
export interface ReductionEdge {
  id: number;
  from: number;
  to: number;
  path: string;
}
export interface ReductionGraph {
  nodes: ReductionNode[];
  edges: ReductionEdge[];
  truncated: boolean;
}
/** Breadth-first exploration modulo alpha, preserving distinct redexes and self loops. */
export function reductionGraph(root: LambdaTerm, maxDepth = 5, maxNodes = 60): ReductionGraph {
  if (!Number.isFinite(maxDepth)) maxDepth = 5;
  if (!Number.isFinite(maxNodes)) maxNodes = 60;
  maxDepth = Math.max(0, Math.min(10, Math.floor(maxDepth)));
  maxNodes = Math.max(1, Math.min(LAMBDA_LIMITS.graphNodes, Math.floor(maxNodes)));
  const nodes: ReductionNode[] = [];
  const edges: ReductionEdge[] = [];
  const known = new Map<string, number>();
  const add = (term: LambdaTerm, depth: number) => {
    const node: ReductionNode = {
      id: nodes.length,
      term,
      depth,
      key: alphaKey(term),
      size: lambdaSize(term),
      normal: redexPaths(term).length === 0,
      frontier: false,
    };
    nodes.push(node);
    known.set(node.key, node.id);
    return node.id;
  };
  add(root, 0);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.normal) continue;
    if (node.depth >= maxDepth) {
      node.frontier = true;
      continue;
    }
    for (const path of redexPaths(node.term)) {
      if (edges.length >= LAMBDA_LIMITS.graphEdges) {
        node.frontier = true;
        break;
      }
      let target: LambdaTerm;
      try {
        target = reduceLambda(node.term, path).after;
      } catch (error) {
        if (!(error instanceof LambdaError)) throw error;
        node.frontier = true;
        continue;
      }
      const key = alphaKey(target);
      let to = known.get(key);
      if (to === undefined) {
        if (nodes.length >= maxNodes) {
          node.frontier = true;
          continue;
        }
        to = add(target, node.depth + 1);
      }
      edges.push({ id: edges.length, from: node.id, to, path });
    }
  }
  return { nodes, edges, truncated: nodes.some((n) => n.frontier) };
}

export const LAMBDA_EXAMPLES = [
  { id: 'identity', fr: 'Renvoyer : I I', en: 'Return: I I', source: '(λx. x) (λz. z)' },
  { id: 'copy', fr: 'Copier : D I', en: 'Copy: D I', source: '(λx. x x) (λz. z)' },
  { id: 'erase', fr: 'Effacer : Q D', en: 'Erase: Q D', source: '(λa. λb. b) (λx. x x)' },
  { id: 'twice', fr: 'Appliquer deux fois', en: 'Apply twice', source: 'λf. λx. f (f x)' },
  {
    id: 'paths',
    fr: 'Trois ou quatre étapes',
    en: 'Three or four steps',
    source: '(λx. x x) ((λy. y) (λz. z))',
  },
  { id: 'omega', fr: 'Une boucle : Ω', en: 'A loop: Ω', source: '(λx. x x) (λx. x x)' },
  {
    id: 'escape',
    fr: 'Éviter la boucle : Q Ω',
    en: 'Skip the loop: Q Ω',
    source: '(λa. λb. b) ((λx. x x) (λx. x x))',
  },
  { id: 'capture', fr: 'Garder y libre', en: 'Keep y free', source: '(λx. λy. x) y' },
  {
    id: 'church',
    fr: 'Successeur de deux',
    en: 'Successor of two',
    source: '(λn. λf. λx. f (n f x)) (λg. λz. g (g z))',
  },
] as const;
