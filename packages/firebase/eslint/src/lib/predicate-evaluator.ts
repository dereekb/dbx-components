import { parse, ParseError } from '@marcbachmann/cel-js';
import type { Maybe } from '@dereekb/util';

/**
 * One disjunct of an `allow write: if ...` predicate after helper-function expansion
 * and DNF conversion. Always carries a numeric byte cap plus at least one MIME constraint.
 */
export interface PredicateBranch {
  readonly maxFileSizeBytes: number;
  readonly allowedMimeLiterals: readonly string[];
  readonly allowedMimeRegexes: readonly string[];
}

/**
 * Result of evaluating a CEL `allow write` predicate. When the predicate cannot be reduced
 * to at least one resource-constraining branch, {@link PredicateEvaluation.branches} is
 * empty and `unsupported` carries a human-readable reason.
 */
export interface PredicateEvaluation {
  readonly branches: readonly PredicateBranch[];
  readonly unsupported?: string;
}

/**
 * Map of helper-function names → return-expression text. Entries are sourced from the
 * surrounding `storage.rules` scope (function definitions reachable from the `match` block).
 */
export interface HelperFunctionTable {
  readonly definitions: ReadonlyMap<string, string>;
}

/**
 * Bare minimal shape we read off a cel-js AST node. Structurally a supertype of cel-js's
 * `ASTNode` union, so casting in either direction is safe at the package boundary.
 */
interface AstNode {
  readonly op: string;
  readonly args: unknown;
}

const REGEX_METACHARS_RE = /[.*+?^${}()|[\]\\]/;
const HELPER_INLINE_MAX_DEPTH: number = 8;

const REQUEST_RESOURCE_SIZE_PATH: readonly string[] = ['request', 'resource', 'size'];
const REQUEST_RESOURCE_CONTENT_TYPE_PATH: readonly string[] = ['request', 'resource', 'contentType'];

/**
 * Evaluates a CEL `allow write` predicate into the list of `(size, MIME)` branches the
 * `require-storagefile-policy-matches-rules` lint rule cross-checks against the TypeScript
 * upload-policy registry.
 *
 * Pipeline: parse with `@marcbachmann/cel-js`, inline zero-arg helper calls at the AST
 * level, expand to disjunctive normal form, then for each DNF clause harvest:
 *
 * - `request.resource.size < N` size caps,
 * - `request.resource.contentType == '...'` literal MIMEs,
 * - `request.resource.contentType.matches('...')` MIME regexes,
 * - `request.resource.contentType in [...]` MIME-list literals.
 *
 * A clause becomes a {@link PredicateBranch} only when it has ≥1 size cap AND ≥1 MIME
 * constraint. Auth-only clauses (e.g. `request.auth.token.a == 1`) are silently dropped —
 * they don't restrict uploads from the storage perspective.
 *
 * @param predicate - The raw predicate text (everything between `if` and `;` in the rules file).
 * @param helpers - Helper-function bodies in scope at the `match` block.
 * @returns Reduced branches, plus an `unsupported` reason when reduction yields zero branches or the predicate fails to parse.
 */
export function evaluatePredicate(predicate: string, helpers: HelperFunctionTable): PredicateEvaluation {
  let result: PredicateEvaluation;
  let ast: Maybe<AstNode> = null;
  let parseFailure: Maybe<string> = null;
  try {
    ast = parse(predicate).ast as unknown as AstNode;
  } catch (error) {
    const message: string = error instanceof ParseError || error instanceof Error ? error.message : String(error);
    parseFailure = `cel-js parse error: ${message}`;
  }

  if (!ast) {
    result = { branches: [], unsupported: parseFailure ?? 'cel-js parse error: unknown' };
  } else {
    const expanded: AstNode = inlineHelpers(ast, helpers, 0);
    const clauses: AstNode[][] = toDnf(expanded);
    const branches: PredicateBranch[] = [];
    const seen: Set<string> = new Set();
    for (const clause of clauses) {
      const branch: Maybe<PredicateBranch> = reduceClause(clause);
      if (branch) {
        const key: string = branchSignature(branch);
        if (!seen.has(key)) {
          seen.add(key);
          branches.push(branch);
        }
      }
    }
    if (branches.length === 0) {
      result = { branches: [], unsupported: 'no branch of the allow predicate carries both a request.resource.size cap and a contentType constraint' };
    } else {
      result = { branches };
    }
  }
  return result;
}

/**
 * Recursively rebuilds the AST so every zero-arg `call` to a known helper is replaced by
 * the helper's parsed body. Bounded depth prevents accidental infinite recursion between
 * mutually-calling helpers. Non-zero-arg calls and unknown identifiers pass through.
 *
 * @param node - The node to expand.
 * @param helpers - Helper definitions in scope.
 * @param depth - Current recursion depth (internal).
 * @returns A new AST with helpers inlined.
 */
function inlineHelpers(node: AstNode, helpers: HelperFunctionTable, depth: number): AstNode {
  let result: AstNode = node;
  if (depth < HELPER_INLINE_MAX_DEPTH) {
    if (node.op === 'call') {
      const callArgs = node.args as [string, AstNode[]];
      const name: string = callArgs[0];
      const args: AstNode[] = callArgs[1];
      const body: Maybe<string> = args.length === 0 ? helpers.definitions.get(name) : null;
      if (typeof body === 'string') {
        try {
          const innerAst = parse(body).ast as unknown as AstNode;
          result = inlineHelpers(innerAst, helpers, depth + 1);
        } catch {
          result = mapChildren(node, (child) => inlineHelpers(child, helpers, depth));
        }
      } else {
        result = mapChildren(node, (child) => inlineHelpers(child, helpers, depth));
      }
    } else {
      result = mapChildren(node, (child) => inlineHelpers(child, helpers, depth));
    }
  }
  return result;
}

/**
 * Rebuilds an AST node with each direct child remapped through `fn`. Handles every cel-js
 * operator that may carry child nodes; literal-value and identifier nodes pass through.
 *
 * @param node - The node to rebuild.
 * @param fn - Child remapper.
 * @returns A new node of the same op carrying remapped children.
 */
function mapChildren(node: AstNode, fn: (child: AstNode) => AstNode): AstNode {
  let result: AstNode;
  const op: string = node.op;
  const args: unknown = node.args;
  if (op === 'value' || op === 'id') {
    result = node;
  } else if (op === '.' || op === '.?') {
    const [receiver, prop] = args as [AstNode, string];
    result = { op, args: [fn(receiver), prop] };
  } else if (op === 'call') {
    const [name, callArgs] = args as [string, AstNode[]];
    result = { op, args: [name, callArgs.map(fn)] };
  } else if (op === 'rcall') {
    const [name, receiver, callArgs] = args as [string, AstNode, AstNode[]];
    result = { op, args: [name, fn(receiver), callArgs.map(fn)] };
  } else if (op === '!_' || op === '-_') {
    result = { op, args: fn(args as AstNode) };
  } else if (op === '?:') {
    const [c, t, e] = args as [AstNode, AstNode, AstNode];
    result = { op, args: [fn(c), fn(t), fn(e)] };
  } else if (op === 'list') {
    const items = args as AstNode[];
    result = { op, args: items.map(fn) };
  } else if (op === 'map') {
    const entries = args as [AstNode, AstNode][];
    result = { op, args: entries.map(([k, v]) => [fn(k), fn(v)] as [AstNode, AstNode]) };
  } else if (Array.isArray(args) && args.length === 2 && isAstNode(args[0]) && isAstNode(args[1])) {
    result = { op, args: [fn(args[0] as AstNode), fn(args[1] as AstNode)] };
  } else {
    result = node;
  }
  return result;
}

/**
 * Structural check used by {@link mapChildren} to detect AST-node children inside generic
 * binary-op args tuples.
 *
 * @param value - The candidate value.
 * @returns True when value has the AST `{op, args}` shape.
 */
function isAstNode(value: unknown): value is AstNode {
  return typeof value === 'object' && value !== null && typeof (value as { op?: unknown }).op === 'string';
}

/**
 * Converts an AST predicate to disjunctive normal form by pushing `&&` inside `||`. Each
 * output clause is a flat conjunction (array) of opaque atoms — anything that isn't an
 * `&&` or `||` node. Negation, ternary, comparison, etc. all remain as single atoms.
 *
 * @param node - The expanded AST.
 * @returns Outer array of clauses; inner arrays of atom nodes.
 */
function toDnf(node: AstNode): AstNode[][] {
  let result: AstNode[][];
  if (node.op === '||') {
    const [l, r] = node.args as [AstNode, AstNode];
    result = [...toDnf(l), ...toDnf(r)];
  } else if (node.op === '&&') {
    const [l, r] = node.args as [AstNode, AstNode];
    const left: AstNode[][] = toDnf(l);
    const right: AstNode[][] = toDnf(r);
    result = [];
    for (const ld of left) {
      for (const rd of right) {
        result.push([...ld, ...rd]);
      }
    }
  } else {
    result = [[node]];
  }
  return result;
}

interface ClauseAccumulator {
  readonly sizeCaps: number[];
  readonly literals: Set<string>;
  readonly regexes: Set<string>;
}

/**
 * Reduces a single DNF clause to a {@link PredicateBranch} when its atoms carry both a
 * `request.resource.size <` cap and at least one MIME constraint.
 *
 * When the same clause produces multiple size caps via `&&`, the tightest (minimum) wins —
 * every conjunct must hold, so the smallest cap dominates.
 *
 * @param atoms - The clause's atom nodes (post-DNF).
 * @returns The parsed branch, or null when the clause is auth-only / unsupported.
 */
function reduceClause(atoms: readonly AstNode[]): Maybe<PredicateBranch> {
  let result: Maybe<PredicateBranch> = null;
  const acc: ClauseAccumulator = { sizeCaps: [], literals: new Set(), regexes: new Set() };

  for (const atom of atoms) {
    collectResourceConstraints(atom, acc);
  }

  if (acc.sizeCaps.length > 0 && (acc.literals.size > 0 || acc.regexes.size > 0)) {
    let tightest: number = acc.sizeCaps[0];
    for (const cap of acc.sizeCaps) {
      if (cap < tightest) tightest = cap;
    }
    result = {
      maxFileSizeBytes: tightest,
      allowedMimeLiterals: Array.from(acc.literals),
      allowedMimeRegexes: Array.from(acc.regexes)
    };
  }
  return result;
}

/**
 * Inspects a single atom node and, if it constrains `request.resource`, mutates `acc`.
 * Unhandled shapes (auth atoms, negation, ternary, opaque calls) are no-ops. Dispatches
 * to per-op extractors so each shape stays small and individually testable.
 *
 * @param atom - The atom node from one DNF clause.
 * @param acc - The accumulator for size caps, literal MIMEs, and regex MIMEs.
 */
function collectResourceConstraints(atom: AstNode, acc: ClauseAccumulator): void {
  const op: string = atom.op;
  if (op === '<' || op === '<=') {
    extractSizeCap(atom, acc);
  } else if (op === '==') {
    extractMimeEquality(atom, acc);
  } else if (op === 'rcall') {
    extractMimeMatches(atom, acc);
  } else if (op === 'in') {
    extractMimeInList(atom, acc);
  }
}

/**
 * Handles `request.resource.size < N` / `<= N`: folds the RHS to a number and pushes it
 * onto the clause's size caps.
 *
 * @param atom - The comparison atom (already known to be `<` or `<=`).
 * @param acc - The clause accumulator.
 */
function extractSizeCap(atom: AstNode, acc: ClauseAccumulator): void {
  const [lhs, rhs] = atom.args as [AstNode, AstNode];
  if (isMemberPath(lhs, REQUEST_RESOURCE_SIZE_PATH)) {
    const cap: Maybe<number> = foldNumericNode(rhs);
    if (typeof cap === 'number') {
      acc.sizeCaps.push(cap);
    }
  }
}

/**
 * Handles `request.resource.contentType == '<literal>'` (either operand order): pushes
 * the string literal onto `acc.literals`.
 *
 * @param atom - The equality atom.
 * @param acc - The clause accumulator.
 */
function extractMimeEquality(atom: AstNode, acc: ClauseAccumulator): void {
  const [lhs, rhs] = atom.args as [AstNode, AstNode];
  let mimeNode: Maybe<AstNode> = null;
  if (isMemberPath(lhs, REQUEST_RESOURCE_CONTENT_TYPE_PATH)) {
    mimeNode = rhs;
  } else if (isMemberPath(rhs, REQUEST_RESOURCE_CONTENT_TYPE_PATH)) {
    mimeNode = lhs;
  }
  if (mimeNode?.op === 'value' && typeof mimeNode.args === 'string') {
    acc.literals.add(mimeNode.args);
  }
}

/**
 * Handles `request.resource.contentType.matches('<pattern>')`: pushes onto `acc.regexes`
 * when the pattern has regex metacharacters, else onto `acc.literals` (matches the prior
 * parser's behavior of treating metachar-free `matches` calls as literal equality).
 *
 * @param atom - The `rcall` atom.
 * @param acc - The clause accumulator.
 */
function extractMimeMatches(atom: AstNode, acc: ClauseAccumulator): void {
  const [method, receiver, args] = atom.args as [string, AstNode, AstNode[]];
  if (method === 'matches' && isMemberPath(receiver, REQUEST_RESOURCE_CONTENT_TYPE_PATH) && args.length === 1) {
    const arg: AstNode = args[0];
    if (arg.op === 'value' && typeof arg.args === 'string') {
      const pattern: string = arg.args;
      if (REGEX_METACHARS_RE.test(pattern)) {
        acc.regexes.add(pattern);
      } else {
        acc.literals.add(pattern);
      }
    }
  }
}

/**
 * Handles `request.resource.contentType in ['<lit1>', '<lit2>', ...]`: every list entry
 * must be a string literal; partial lists are ignored.
 *
 * @param atom - The `in` atom.
 * @param acc - The clause accumulator.
 */
function extractMimeInList(atom: AstNode, acc: ClauseAccumulator): void {
  const [lhs, rhs] = atom.args as [AstNode, AstNode];
  if (isMemberPath(lhs, REQUEST_RESOURCE_CONTENT_TYPE_PATH) && rhs.op === 'list') {
    const items = rhs.args as AstNode[];
    const collected: string[] = [];
    let allStrings: boolean = true;
    for (const item of items) {
      if (item.op === 'value' && typeof item.args === 'string') {
        collected.push(item.args);
      } else {
        allStrings = false;
        break;
      }
    }
    if (allStrings) {
      for (const value of collected) {
        acc.literals.add(value);
      }
    }
  }
}

/**
 * Walks a chain of `.` access nodes (e.g. `request.resource.size`) and tests whether it
 * matches the expected segment sequence ending at the root `id` node.
 *
 * @param node - The candidate node.
 * @param segments - The full path segments, root first (e.g. `['request','resource','size']`).
 * @param endIndex - Internal: number of segments still to match (defaults to `segments.length`).
 * @returns True when the node represents exactly the given member path.
 */
function isMemberPath(node: AstNode, segments: readonly string[], endIndex: number = segments.length): boolean {
  let result: boolean = false;
  if (endIndex === 1) {
    result = node.op === 'id' && node.args === segments[0];
  } else if (endIndex > 1 && node.op === '.') {
    const [receiver, prop] = node.args as [AstNode, string];
    if (prop === segments[endIndex - 1]) {
      result = isMemberPath(receiver, segments, endIndex - 1);
    }
  }
  return result;
}

/**
 * Folds a numeric AST subtree to a JS `number`. Handles cel-js BigInt integer literals,
 * floating-point literals, unary minus, and `+ - * /`. Returns null for anything else
 * (notably ternary, identifiers, calls, comparisons).
 *
 * cel-js does NOT fold constants — `8 * 1024 * 1024` arrives as three `*` nodes wrapping
 * BigInt `value` leaves — so a numeric folder is required even when the source text reads
 * like a pure literal.
 *
 * @param node - The numeric expression node.
 * @returns The folded number, or null when any operand is unresolvable.
 */
function foldNumericNode(node: AstNode): Maybe<number> {
  let result: Maybe<number> = null;
  if (node.op === 'value') {
    const value: unknown = node.args;
    if (typeof value === 'bigint') {
      const num: number = Number(value);
      if (Number.isFinite(num)) {
        result = num;
      }
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      result = value;
    }
  } else if (node.op === '-_') {
    const inner: Maybe<number> = foldNumericNode(node.args as AstNode);
    if (typeof inner === 'number') {
      result = -inner;
    }
  } else if (node.op === '+' || node.op === '-' || node.op === '*' || node.op === '/') {
    const [l, r] = node.args as [AstNode, AstNode];
    const left: Maybe<number> = foldNumericNode(l);
    const right: Maybe<number> = foldNumericNode(r);
    if (typeof left === 'number' && typeof right === 'number') {
      if (node.op === '+') {
        result = left + right;
      } else if (node.op === '-') {
        result = left - right;
      } else if (node.op === '*') {
        result = left * right;
      } else if (right !== 0) {
        result = left / right;
      }
    }
  }
  return result;
}

/**
 * Stable signature for a parsed branch so duplicate DNF clauses (e.g. produced when an
 * auth-only OR is distributed across a resource-constraining AND) collapse to a single
 * result entry.
 *
 * @param branch - The parsed branch.
 * @returns A signature string usable as a Map/Set key.
 */
function branchSignature(branch: PredicateBranch): string {
  const literals: string[] = [...branch.allowedMimeLiterals].sort();
  const regexes: string[] = [...branch.allowedMimeRegexes].sort();
  return `${branch.maxFileSizeBytes}|${literals.join(',')}|${regexes.join(',')}`;
}
