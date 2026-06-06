import type { Maybe } from '@dereekb/util';
import { type AstNode, type ImportRegistry, callExpressionCalleeName, unwrapTypeAssertion } from './util';

/**
 * One segment of a folded upload path. A `literal` segment carries its fixed text (e.g.
 * `uploads`, `jr`, `photo.img`); a `wildcard` segment stands in for any single path segment
 * (a destructured param, a positional argument, a `mergeSlashPaths` variadic element) and
 * compares equal to a Firebase rules `{var}` / `{var=**}` path variable.
 */
export interface FoldedPathSegment {
  readonly kind: 'literal' | 'wildcard';
  readonly value: string;
}

/**
 * The result of statically folding a `buildUploadPath` builder: an ordered list of
 * {@link FoldedPathSegment}s with leading/trailing/duplicate `/` collapsed.
 */
export interface FoldedUploadPath {
  readonly segments: readonly FoldedPathSegment[];
}

/**
 * Outcome of {@link foldUploadPath}: either a folded path or a human-readable reason the
 * builder could not be reduced to a constant path template. The rule reports the reason via
 * the `unresolvablePolicyPath` diagnostic so authors either make the builder foldable or opt
 * out explicitly — the analyzer never guesses.
 */
export type FoldUploadPathResult = { readonly ok: true; readonly path: FoldedUploadPath } | { readonly ok: false; readonly reason: string };

/**
 * Resolves an imported binding (const declarator or function/arrow declaration) to its
 * declaration node in another module, plus the scope that node lives in so further
 * identifiers inside it resolve against that module's own imports/consts.
 *
 * Supplied by the rule when type information is available; absent in pure-AST contexts
 * (e.g. the unit tests), in which case cross-module references fold to "unresolvable".
 */
export interface ImportedBindingResolver {
  resolve(name: string, referenceNode: AstNode, fromScope: FoldScope): Maybe<ResolvedBinding>;
}

/**
 * A binding resolved to its declaration node plus the scope it belongs to.
 */
export interface ResolvedBinding {
  readonly node: AstNode;
  readonly scope: FoldScope;
}

/**
 * The lexical scope a node is folded in: the Program it belongs to and the import registry
 * for that module. Threaded through folding so an inlined cross-module function resolves its
 * own identifiers against its own module.
 */
export interface FoldScope {
  readonly program: AstNode;
  readonly importRegistry: ImportRegistry;
  readonly resolver: Maybe<ImportedBindingResolver>;
}

/**
 * A folded string fragment stream: literal text plus opaque wildcard placeholders. Split on
 * `/` boundaries to recover {@link FoldedPathSegment}s.
 */
type Frag = { readonly kind: 'literal'; readonly value: string } | { readonly kind: 'wildcard' };

/**
 * A value bound to a parameter during inlining: a scalar fragment stream, or a list of
 * fragment streams (for a rest/variadic parameter expanded from the remaining arguments).
 */
type EnvValue = { readonly kind: 'scalar'; readonly frags: readonly Frag[] } | { readonly kind: 'list'; readonly items: readonly (readonly Frag[])[] };

interface FoldFrame {
  readonly scope: FoldScope;
  readonly env: ReadonlyMap<string, EnvValue>;
}

const MAX_FOLD_DEPTH: number = 24;
const PATH_SEPARATOR: string = '/';

/**
 * `@dereekb/util` path combinators that merge a single array argument of path parts. Modeled
 * exactly: drop statically-empty parts, join with a `/` boundary, collapse empty segments.
 */
const MERGE_COMBINATOR_NAMES: ReadonlySet<string> = new Set(['mergeSlashPaths']);

/**
 * `@dereekb/util` path combinators that take a single path argument and only normalize
 * slashes (collapse `//`, prepend a leading `/`). Structurally these are identity over the
 * abstract domain because {@link fragsToSegments} already collapses empty segments.
 */
const NORMALIZE_COMBINATOR_NAMES: ReadonlySet<string> = new Set(['fixMultiSlashesInSlashPath', 'replaceMultipleFilePathsInSlashPath', 'toAbsoluteSlashPathStartType', 'toRelativeSlashPathStartType', 'removeTrailingSlashes', 'addTrailingSlash']);

/**
 * Statically folds a `StorageFilePurposeUploadPolicy.buildUploadPath` builder to an abstract
 * path template. The builder is an arrow `(input) => <path expression>` whose destructured /
 * positional params become wildcards and whose body is a composition of string literals,
 * `const`s, `@dereekb/util` path combinators, and foldable single-`return` helper functions.
 *
 * @param builderNode - The `buildUploadPath` value node (arrow / function expression, possibly behind a type assertion).
 * @param scope - The lexical scope the builder lives in.
 * @returns The folded path, or a reason the builder is unresolvable.
 */
export function foldUploadPath(builderNode: AstNode, scope: FoldScope): FoldUploadPathResult {
  let result: FoldUploadPathResult;
  const fn: AstNode = unwrapTypeAssertion(builderNode);
  if (fn?.type !== 'ArrowFunctionExpression' && fn?.type !== 'FunctionExpression') {
    result = { ok: false, reason: 'buildUploadPath is not an inline arrow/function expression' };
  } else {
    const env: Map<string, EnvValue> = new Map();
    bindParamsAsWildcards(fn.params ?? [], env);
    const body: Maybe<AstNode> = functionBodyExpression(fn);
    if (body) {
      const frags: Maybe<readonly Frag[]> = foldFrags(body, { scope, env }, 0);
      if (frags) {
        result = { ok: true, path: { segments: fragsToSegments(frags) } };
      } else {
        result = { ok: false, reason: 'buildUploadPath does not fold to a constant path (unknown const, unmodeled call, or runtime value)' };
      }
    } else {
      result = { ok: false, reason: 'buildUploadPath body is not a single return expression' };
    }
  }
  return result;
}

/**
 * Returns the single expression a function-like node evaluates to: an arrow's expression
 * body directly, or the argument of a lone `return` statement in a block body.
 *
 * @param fn - The arrow / function expression node.
 * @returns The returned expression, or null when the body is not a single return.
 */
function functionBodyExpression(fn: AstNode): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  const body: AstNode = fn.body;
  if (body && body.type !== 'BlockStatement') {
    result = body;
  } else if (body?.type === 'BlockStatement') {
    const statements: AstNode[] = body.body ?? [];
    if (statements.length === 1 && statements[0]?.type === 'ReturnStatement' && statements[0].argument) {
      result = statements[0].argument;
    }
  }
  return result;
}

/**
 * Binds each parameter pattern to a wildcard (or a wildcard-per-property for an object
 * destructure). The builder never needs a param's runtime content — a param maps to a single
 * path segment, which compares equal to a rules `{var}`.
 *
 * @param params - The parameter pattern nodes.
 * @param env - The environment to mutate.
 */
function bindParamsAsWildcards(params: readonly AstNode[], env: Map<string, EnvValue>): void {
  for (const param of params) {
    bindPatternAsWildcards(param, env);
  }
}

function bindPatternAsWildcards(param: AstNode, env: Map<string, EnvValue>): void {
  if (param?.type === 'Identifier') {
    env.set(param.name, wildcardScalar());
  } else if (param?.type === 'ObjectPattern') {
    for (const property of param.properties ?? []) {
      if (property.type === 'Property' && property.key?.type === 'Identifier') {
        env.set(property.key.name, wildcardScalar());
      } else if (property.type === 'RestElement' && property.argument?.type === 'Identifier') {
        env.set(property.argument.name, { kind: 'list', items: [] });
      }
    }
  } else if (param?.type === 'RestElement' && param.argument?.type === 'Identifier') {
    env.set(param.argument.name, { kind: 'list', items: [] });
  } else if (param?.type === 'AssignmentPattern' && param.left) {
    bindPatternAsWildcards(param.left, env);
  }
}

function wildcardScalar(): EnvValue {
  return { kind: 'scalar', frags: [{ kind: 'wildcard' }] };
}

/**
 * Folds an expression node to a fragment stream, or null when any sub-expression is
 * statically unknown.
 *
 * @param node - The expression node.
 * @param frame - The current scope + environment.
 * @param depth - Recursion depth guard.
 * @returns The fragment stream, or null when unfoldable.
 */
function foldFrags(node: AstNode, frame: FoldFrame, depth: number): Maybe<readonly Frag[]> {
  let result: Maybe<readonly Frag[]> = null;
  if (node && depth <= MAX_FOLD_DEPTH) {
    if (node.type === 'Literal') {
      result = typeof node.value === 'string' ? [{ kind: 'literal', value: node.value }] : null;
    } else if (node.type === 'TemplateLiteral') {
      result = foldTemplateLiteral(node, frame, depth);
    } else if (node.type === 'Identifier') {
      result = foldIdentifier(node, frame, depth);
    } else if (node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion' || node.type === 'TSNonNullExpression') {
      result = node.expression ? foldFrags(node.expression, frame, depth) : null;
    } else if (node.type === 'BinaryExpression' && node.operator === '+') {
      result = foldStringConcat(node, frame, depth);
    } else if (node.type === 'CallExpression') {
      result = foldCall(node, frame, depth);
    }
  }
  return result;
}

function foldTemplateLiteral(node: AstNode, frame: FoldFrame, depth: number): Maybe<readonly Frag[]> {
  let result: Maybe<readonly Frag[]> = [];
  const quasis: AstNode[] = node.quasis ?? [];
  const expressions: AstNode[] = node.expressions ?? [];
  for (let i = 0; i < quasis.length && result; i++) {
    const cooked: string = quasis[i]?.value?.cooked ?? '';
    const next: Frag[] = [...result, { kind: 'literal', value: cooked }];
    if (i < expressions.length) {
      const exprFrags: Maybe<readonly Frag[]> = foldFrags(expressions[i], frame, depth + 1);
      result = exprFrags ? [...next, ...exprFrags] : null;
    } else {
      result = next;
    }
  }
  return result;
}

function foldStringConcat(node: AstNode, frame: FoldFrame, depth: number): Maybe<readonly Frag[]> {
  let result: Maybe<readonly Frag[]> = null;
  const left: Maybe<readonly Frag[]> = foldFrags(node.left, frame, depth + 1);
  const right: Maybe<readonly Frag[]> = foldFrags(node.right, frame, depth + 1);
  if (left && right) {
    result = [...left, ...right];
  }
  return result;
}

/**
 * Folds an identifier: a bound (scalar) param/local, then a top-level const in the current
 * module, then an imported const in another module. A list-bound identifier (rest param) used
 * as a string is unfoldable.
 *
 * @param node - The identifier node.
 * @param frame - The current scope + environment.
 * @param depth - Recursion depth guard.
 * @returns The fragment stream, or null.
 */
function foldIdentifier(node: AstNode, frame: FoldFrame, depth: number): Maybe<readonly Frag[]> {
  let result: Maybe<readonly Frag[]> = null;
  const name: string = node.name;
  const bound: Maybe<EnvValue> = frame.env.get(name);
  if (bound) {
    result = bound.kind === 'scalar' ? bound.frags : null;
  } else {
    const local: Maybe<AstNode> = findTopLevelConstInit(frame.scope.program, name);
    if (local) {
      result = foldFrags(local, { scope: frame.scope, env: new Map() }, depth + 1);
    } else {
      const imported: Maybe<ResolvedBinding> = resolveImported(name, node, frame.scope);
      const init: Maybe<AstNode> = imported ? declaratorInit(imported.node) : null;
      if (imported && init) {
        result = foldFrags(init, { scope: imported.scope, env: new Map() }, depth + 1);
      }
    }
  }
  return result;
}

/**
 * Folds a call expression: a modeled `@dereekb/util` path combinator, or an inlinable
 * single-`return` helper function (local or imported).
 *
 * @param node - The CallExpression node.
 * @param frame - The current scope + environment.
 * @param depth - Recursion depth guard.
 * @returns The fragment stream, or null.
 */
function foldCall(node: AstNode, frame: FoldFrame, depth: number): Maybe<readonly Frag[]> {
  let result: Maybe<readonly Frag[]> = null;
  const calleeName: Maybe<string> = callExpressionCalleeName(node.callee);
  const args: AstNode[] = node.arguments ?? [];
  if (calleeName && MERGE_COMBINATOR_NAMES.has(calleeName)) {
    result = foldMergeCombinator(args[0], frame, depth);
  } else if (calleeName && NORMALIZE_COMBINATOR_NAMES.has(calleeName)) {
    result = args.length === 1 ? foldFrags(args[0], frame, depth + 1) : null;
  } else if (calleeName) {
    result = foldInlinedFunction({ calleeName, call: node, frame, depth });
  }
  return result;
}

interface InlineFunctionInput {
  readonly calleeName: string;
  readonly call: AstNode;
  readonly frame: FoldFrame;
  readonly depth: number;
}

interface BindArgumentsInput {
  readonly params: readonly AstNode[];
  readonly callArgs: readonly AstNode[];
  readonly frame: FoldFrame;
  readonly depth: number;
}

/**
 * Models `mergeSlashPaths([...])`: folds the single array argument to a list of parts, drops
 * statically-empty parts, and joins them with a `/` boundary. Empty-segment collapse is left
 * to {@link fragsToSegments}.
 *
 * @param arrayArg - The array argument node.
 * @param frame - The current scope + environment.
 * @param depth - Recursion depth guard.
 * @returns The joined fragment stream, or null when any element is unfoldable.
 */
function foldMergeCombinator(arrayArg: AstNode, frame: FoldFrame, depth: number): Maybe<readonly Frag[]> {
  let result: Maybe<readonly Frag[]> = null;
  const items: Maybe<readonly (readonly Frag[])[]> = arrayArg ? foldList(arrayArg, frame, depth) : null;
  if (items) {
    const joined: Frag[] = [];
    let first: boolean = true;
    for (const item of items) {
      if (!isStaticallyEmpty(item)) {
        if (!first) {
          joined.push({ kind: 'literal', value: PATH_SEPARATOR });
        }
        joined.push(...item);
        first = false;
      }
    }
    result = joined;
  }
  return result;
}

/**
 * Inlines a foldable single-`return` helper function called by name: binds its parameters to
 * the folded arguments (a rest parameter collects the remaining arguments as a list), then
 * folds its body in the function's own scope.
 *
 * @param input - The callee name, the CallExpression node, the caller's frame, and the depth guard.
 * @returns The fragment stream, or null when the function is not foldable.
 */
function foldInlinedFunction(input: InlineFunctionInput): Maybe<readonly Frag[]> {
  const { calleeName, call, frame, depth } = input;
  let result: Maybe<readonly Frag[]> = null;
  const resolved: Maybe<ResolvedBinding> = resolveFunctionBinding(calleeName, call.callee, frame.scope);
  const fn: Maybe<AstNode> = resolved ? functionFromBinding(resolved.node) : null;
  const body: Maybe<AstNode> = fn ? functionBodyExpression(fn) : null;
  if (resolved && fn && body) {
    const env: Maybe<Map<string, EnvValue>> = bindCallArguments({ params: fn.params ?? [], callArgs: call.arguments ?? [], frame, depth });
    if (env) {
      result = foldFrags(body, { scope: resolved.scope, env }, depth + 1);
    }
  }
  return result;
}

/**
 * Binds call arguments to parameter patterns. Positional identifiers take the folded
 * argument; a trailing rest parameter collects the remaining folded arguments as a list.
 * Spread arguments are expanded from a list-valued operand. Any unfoldable argument fails the
 * whole binding (sound bail).
 *
 * @param input - The parameter patterns, the call argument nodes, the caller's frame, and the depth guard.
 * @returns The new environment, or null when an argument is unfoldable.
 */
function bindCallArguments(input: BindArgumentsInput): Maybe<Map<string, EnvValue>> {
  const { params, callArgs, frame, depth } = input;
  const argValues: Maybe<readonly (readonly Frag[])[]> = foldArgumentList(callArgs, frame, depth);
  let result: Maybe<Map<string, EnvValue>> = null;
  if (argValues) {
    const env: Map<string, EnvValue> = new Map();
    let ok: boolean = true;
    let argIndex: number = 0;
    for (const param of params) {
      if (param?.type === 'RestElement' && param.argument?.type === 'Identifier') {
        env.set(param.argument.name, { kind: 'list', items: argValues.slice(argIndex) });
        argIndex = argValues.length;
      } else if (param?.type === 'Identifier') {
        env.set(param.name, { kind: 'scalar', frags: argValues[argIndex] ?? [] });
        argIndex += 1;
      } else {
        ok = false;
        break;
      }
    }
    result = ok ? env : null;
  }
  return result;
}

/**
 * Folds a positional argument list to a flat list of fragment streams, expanding any spread
 * whose operand folds to a list.
 *
 * @param callArgs - The call argument nodes.
 * @param frame - The current scope + environment.
 * @param depth - Recursion depth guard.
 * @returns The expanded list, or null when any argument is unfoldable.
 */
function foldArgumentList(callArgs: readonly AstNode[], frame: FoldFrame, depth: number): Maybe<readonly (readonly Frag[])[]> {
  let result: Maybe<(readonly Frag[])[]> = [];
  for (const arg of callArgs) {
    if (!result) {
      break;
    }
    if (arg?.type === 'SpreadElement') {
      const list: Maybe<readonly (readonly Frag[])[]> = foldSpreadOperand(arg.argument, frame, depth);
      result = list ? [...result, ...list] : null;
    } else {
      const frags: Maybe<readonly Frag[]> = foldFrags(arg, frame, depth + 1);
      result = frags ? [...result, frags] : null;
    }
  }
  return result;
}

/**
 * Folds the operand of a spread (`...x`) to a list of fragment streams: a list-bound rest
 * parameter, or an inline array literal.
 *
 * @param operand - The spread operand node.
 * @param frame - The current scope + environment.
 * @param depth - Recursion depth guard.
 * @returns The list, or null when the operand is statically unknown.
 */
function foldSpreadOperand(operand: AstNode, frame: FoldFrame, depth: number): Maybe<readonly (readonly Frag[])[]> {
  let result: Maybe<readonly (readonly Frag[])[]> = null;
  if (operand?.type === 'Identifier') {
    const bound: Maybe<EnvValue> = frame.env.get(operand.name);
    if (bound?.kind === 'list') {
      result = bound.items;
    }
  } else if (operand?.type === 'ArrayExpression') {
    result = foldList(operand, frame, depth);
  }
  return result;
}

/**
 * Folds an array-literal expression to a list of fragment streams, expanding spreads. Returns
 * null when any element is unfoldable or a spread operand is statically unknown.
 *
 * @param node - The ArrayExpression node.
 * @param frame - The current scope + environment.
 * @param depth - Recursion depth guard.
 * @returns The element list, or null.
 */
function foldList(node: AstNode, frame: FoldFrame, depth: number): Maybe<readonly (readonly Frag[])[]> {
  let result: Maybe<(readonly Frag[])[]> = null;
  if (node?.type === 'ArrayExpression') {
    result = [];
    for (const element of node.elements ?? []) {
      if (!result) {
        break;
      }
      if (element == null) {
        result = null;
      } else if (element.type === 'SpreadElement') {
        const list: Maybe<readonly (readonly Frag[])[]> = foldSpreadOperand(element.argument, frame, depth);
        result = list ? [...result, ...list] : null;
      } else {
        const frags: Maybe<readonly Frag[]> = foldFrags(element, frame, depth + 1);
        result = frags ? [...result, frags] : null;
      }
    }
  }
  return result;
}

/**
 * Returns true when a fragment stream is statically the empty string (no wildcards, no
 * literal characters) — `mergeSlashPaths`'s `.filter(Boolean)` drops such parts.
 *
 * @param frags - The fragment stream.
 * @returns True when the stream contributes nothing.
 */
function isStaticallyEmpty(frags: readonly Frag[]): boolean {
  return frags.every((frag) => frag.kind === 'literal' && frag.value.length === 0);
}

/**
 * Splits a fragment stream into path segments on `/` boundaries, collapsing empty segments
 * (so leading/trailing/duplicate slashes vanish, mirroring `mergeSlashPaths` /
 * `fixMultiSlashesInSlashPath`). A segment containing any wildcard is a wildcard segment.
 *
 * @param frags - The fragment stream.
 * @returns The folded segments.
 */
function fragsToSegments(frags: readonly Frag[]): FoldedPathSegment[] {
  const segments: FoldedPathSegment[] = [];
  let text: string = '';
  let wild: boolean = false;
  const flush = (): void => {
    if (wild) {
      segments.push({ kind: 'wildcard', value: '' });
    } else if (text.length > 0) {
      segments.push({ kind: 'literal', value: text });
    }
    text = '';
    wild = false;
  };
  for (const frag of frags) {
    if (frag.kind === 'wildcard') {
      wild = true;
    } else {
      const pieces: string[] = frag.value.split(PATH_SEPARATOR);
      text += pieces[0];
      for (let i = 1; i < pieces.length; i++) {
        flush();
        text = pieces[i];
      }
    }
  }
  flush();
  return segments;
}

/**
 * Finds a top-level `const`/`let`/`var` declarator's initializer by name in a Program,
 * looking through `export` wrappers. Used to resolve in-module path consts.
 *
 * @param programNode - The Program AST node.
 * @param name - The declarator name.
 * @returns The initializer node, or null.
 */
function findTopLevelConstInit(programNode: AstNode, name: string): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  for (const statement of programNode?.body ?? []) {
    const declaration: AstNode = statement?.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations ?? []) {
        if (declarator.id?.type === 'Identifier' && declarator.id.name === name && declarator.init) {
          result = declarator.init;
        }
      }
    }
  }
  return result;
}

/**
 * Finds a top-level function-like binding by name in a Program (function declaration, or a
 * declarator whose initializer is an arrow / function expression), looking through `export`
 * wrappers.
 *
 * @param programNode - The Program AST node.
 * @param name - The binding name.
 * @returns The function-like node, or null.
 */
function findTopLevelFunction(programNode: AstNode, name: string): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  for (const statement of programNode?.body ?? []) {
    const declaration: AstNode = statement?.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type === 'FunctionDeclaration' && declaration.id?.name === name) {
      result = declaration;
    } else if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations ?? []) {
        const init: AstNode = declarator.init ? unwrapTypeAssertion(declarator.init) : null;
        if (declarator.id?.type === 'Identifier' && declarator.id.name === name && (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression')) {
          result = init;
        }
      }
    }
  }
  return result;
}

/**
 * Returns the function-like node for a resolved binding: a function declaration directly, or
 * the unwrapped arrow / function-expression initializer of a const declarator.
 *
 * @param node - The resolved binding node.
 * @returns The function-like node, or null.
 */
function functionFromBinding(node: AstNode): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  if (node?.type === 'FunctionDeclaration' || node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression') {
    result = node;
  } else if (node?.type === 'VariableDeclarator' && node.init) {
    const init: AstNode = unwrapTypeAssertion(node.init);
    if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
      result = init;
    }
  }
  return result;
}

/**
 * Returns the initializer of a resolved const binding (a declarator node, or an
 * already-initializer node), unwrapping type assertions.
 *
 * @param node - The resolved binding node.
 * @returns The initializer node, or null.
 */
function declaratorInit(node: AstNode): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  if (node?.type === 'VariableDeclarator' && node.init) {
    result = unwrapTypeAssertion(node.init);
  } else if (node) {
    result = unwrapTypeAssertion(node);
  }
  return result;
}

/**
 * Resolves an imported const/value binding to its declaration in another module.
 *
 * @param name - The identifier name.
 * @param referenceNode - The reference node (for type-checker mapping).
 * @param scope - The current scope.
 * @returns The resolved binding, or null.
 */
function resolveImported(name: string, referenceNode: AstNode, scope: FoldScope): Maybe<ResolvedBinding> {
  let result: Maybe<ResolvedBinding> = null;
  if (scope.resolver && scope.importRegistry.localToSource.has(name)) {
    result = scope.resolver.resolve(name, referenceNode, scope);
  }
  return result;
}

/**
 * Resolves a called function to its declaration: first in the current module, then via the
 * imported-binding resolver.
 *
 * @param name - The callee name.
 * @param calleeNode - The callee reference node.
 * @param scope - The current scope.
 * @returns The resolved binding, or null.
 */
function resolveFunctionBinding(name: string, calleeNode: AstNode, scope: FoldScope): Maybe<ResolvedBinding> {
  let result: Maybe<ResolvedBinding> = null;
  const local: Maybe<AstNode> = findTopLevelFunction(scope.program, name);
  if (local) {
    result = { node: local, scope };
  } else {
    result = resolveImported(name, calleeNode, scope);
  }
  return result;
}

/**
 * A resolved identifier's initializer node plus the scope that node lives in (so identifiers
 * inside it resolve against the declaring module's own imports/consts).
 */
interface ResolvedInit {
  readonly init: AstNode;
  readonly scope: FoldScope;
}

/**
 * Resolves an identifier to the initializer of its `const` declaration: first a top-level const
 * in the current module, then an imported const in another module via the binding resolver. Reads
 * the AST initializer — not the checker's type — so annotated-widened / branded consts
 * (`X: BrandedMime = 'image/jpeg'`) still fold to their literal value.
 *
 * @param node - The identifier node.
 * @param scope - The current scope.
 * @returns The initializer node + declaring scope, or null when unresolvable.
 */
function resolveIdentifierInit(node: AstNode, scope: FoldScope): Maybe<ResolvedInit> {
  let result: Maybe<ResolvedInit> = null;
  const local: Maybe<AstNode> = findTopLevelConstInit(scope.program, node.name);
  if (local) {
    result = { init: local, scope };
  } else {
    const imported: Maybe<ResolvedBinding> = resolveImported(node.name, node, scope);
    const init: Maybe<AstNode> = imported ? declaratorInit(imported.node) : null;
    if (imported && init) {
      result = { init, scope: imported.scope };
    }
  }
  return result;
}

/**
 * Folds an expression to a concrete string literal value, reusing the same fragment folder the
 * path evaluator uses (literals, template literals, `const`s — local + cross-module — `+`
 * concatenation, modeled combinators, inlinable helpers). Returns null when the expression cannot
 * be reduced to a wildcard-free constant string, so callers preserve the sound "never guess"
 * contract.
 *
 * @param node - The expression node.
 * @param scope - The lexical scope the expression lives in.
 * @returns The folded string, or null when unresolvable.
 */
export function foldStringExpression(node: AstNode, scope: FoldScope): Maybe<string> {
  const frags: Maybe<readonly Frag[]> = foldFrags(node, { scope, env: new Map() }, 0);
  return frags ? fragsToConcreteString(frags) : null;
}

/**
 * Collapses a fragment stream to a concrete string, returning null when any fragment is a
 * wildcard (a param/runtime value) — a MIME literal or size constant must be fully known.
 *
 * @param frags - The fragment stream.
 * @returns The concrete string, or null when a wildcard is present.
 */
function fragsToConcreteString(frags: readonly Frag[]): Maybe<string> {
  let result: Maybe<string> = null;
  let text: string = '';
  let ok: boolean = true;
  for (const frag of frags) {
    if (frag.kind === 'wildcard') {
      ok = false;
      break;
    }
    text += frag.value;
  }
  if (ok) {
    result = text;
  }
  return result;
}

/**
 * Folds an expression to a list of concrete strings: an inline array literal (each element folded
 * via {@link foldStringExpression}, spreads of statically-known lists expanded), or an identifier
 * resolving to such an array const (local or cross-module). Returns null when any element is
 * unfoldable, so a genuinely dynamic element (e.g. a function call) still surfaces as unresolvable.
 *
 * @param node - The expression node (e.g. an `allowedMimeTypes` value).
 * @param scope - The lexical scope the expression lives in.
 * @returns The folded string list, or null when unresolvable.
 */
export function foldStringArrayExpression(node: AstNode, scope: FoldScope): Maybe<readonly string[]> {
  return foldStringArray(node, scope, 0);
}

function foldStringArray(node: AstNode, scope: FoldScope, depth: number): Maybe<readonly string[]> {
  let result: Maybe<readonly string[]> = null;
  if (node && depth <= MAX_FOLD_DEPTH) {
    const unwrapped: AstNode = unwrapTypeAssertion(node);
    if (unwrapped?.type === 'ArrayExpression') {
      const items: Maybe<readonly (readonly Frag[])[]> = foldList(unwrapped, { scope, env: new Map() }, depth);
      result = items ? fragListsToStrings(items) : null;
    } else if (unwrapped?.type === 'Identifier') {
      const resolved: Maybe<ResolvedInit> = resolveIdentifierInit(unwrapped, scope);
      result = resolved ? foldStringArray(resolved.init, resolved.scope, depth + 1) : null;
    }
  }
  return result;
}

function fragListsToStrings(items: readonly (readonly Frag[])[]): Maybe<readonly string[]> {
  let result: Maybe<string[]> = [];
  for (const item of items) {
    if (!result) {
      break;
    }
    const str: Maybe<string> = fragsToConcreteString(item);
    result = str == null ? null : [...result, str];
  }
  return result;
}

/**
 * Folds a numeric expression to a number: literals, unary `-`/`+`, binary `*`/`+`/`-`/`/`,
 * type-assertion see-through, and identifiers resolving to a numeric `const` (local or
 * cross-module, read from the AST initializer). Returns null when any operand is unresolvable.
 *
 * @param node - The expression node (e.g. a `maxFileSizeBytes` value).
 * @param scope - The lexical scope the expression lives in.
 * @returns The folded number, or null when unresolvable.
 */
export function foldNumericExpression(node: AstNode, scope: FoldScope): Maybe<number> {
  return foldNumeric(node, scope, 0);
}

function foldNumeric(node: AstNode, scope: FoldScope, depth: number): Maybe<number> {
  let result: Maybe<number> = null;
  if (node && depth <= MAX_FOLD_DEPTH) {
    if (node.type === 'Literal' && typeof node.value === 'number') {
      result = node.value;
    } else if (node.type === 'UnaryExpression' && (node.operator === '-' || node.operator === '+')) {
      result = foldNumericUnary(node, scope, depth);
    } else if (node.type === 'BinaryExpression') {
      result = foldNumericBinary(node, scope, depth);
    } else if ((node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion' || node.type === 'TSNonNullExpression') && node.expression) {
      result = foldNumeric(node.expression, scope, depth + 1);
    } else if (node.type === 'Identifier') {
      const resolved: Maybe<ResolvedInit> = resolveIdentifierInit(node, scope);
      result = resolved ? foldNumeric(resolved.init, resolved.scope, depth + 1) : null;
    }
  }
  return result;
}

function foldNumericUnary(node: AstNode, scope: FoldScope, depth: number): Maybe<number> {
  let result: Maybe<number> = null;
  const arg: Maybe<number> = foldNumeric(node.argument, scope, depth + 1);
  if (typeof arg === 'number') {
    result = node.operator === '-' ? -arg : arg;
  }
  return result;
}

function foldNumericBinary(node: AstNode, scope: FoldScope, depth: number): Maybe<number> {
  let result: Maybe<number> = null;
  const left: Maybe<number> = foldNumeric(node.left, scope, depth + 1);
  const right: Maybe<number> = foldNumeric(node.right, scope, depth + 1);
  if (typeof left === 'number' && typeof right === 'number') {
    result = applyNumericOperator(node.operator, left, right);
  }
  return result;
}

function applyNumericOperator(operator: string, left: number, right: number): Maybe<number> {
  let result: Maybe<number> = null;
  if (operator === '*') {
    result = left * right;
  } else if (operator === '+') {
    result = left + right;
  } else if (operator === '-') {
    result = left - right;
  } else if (operator === '/' && right !== 0) {
    result = left / right;
  }
  return result;
}

/**
 * Structurally compares a folded upload path against a Firebase rules match-path segment list
 * (`{var}` / `{var=**}` → wildcard, otherwise literal). Literal segments must match value;
 * wildcard segments compare equal to one another.
 *
 * @param folded - The folded upload path.
 * @param ruleSegments - The rules match-path segments.
 * @returns True when the two segment lists match position-for-position.
 */
export function foldedPathMatchesRuleSegments(folded: FoldedUploadPath, ruleSegments: readonly FoldedPathSegment[]): boolean {
  let result: boolean = folded.segments.length === ruleSegments.length;
  for (let i = 0; result && i < folded.segments.length; i++) {
    const a: FoldedPathSegment = folded.segments[i];
    const b: FoldedPathSegment = ruleSegments[i];
    if (a.kind !== b.kind || (a.kind === 'literal' && a.value !== b.value)) {
      result = false;
    }
  }
  return result;
}

/**
 * Renders a folded path for diagnostics, e.g. `uploads/u/{*}/jr/{*}`.
 *
 * @param folded - The folded path.
 * @returns The display string.
 */
export function describeFoldedPath(folded: FoldedUploadPath): string {
  return folded.segments.map((segment) => (segment.kind === 'wildcard' ? '{*}' : segment.value)).join(PATH_SEPARATOR);
}
