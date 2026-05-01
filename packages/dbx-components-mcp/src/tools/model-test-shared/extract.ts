/**
 * AST extractor for the `dbx_model_test_*` tool cluster.
 *
 * Parses one `.spec.ts` file's structural skeleton via ts-morph and returns
 * the {@link SpecFileTree} consumed by the tree, search, and formatter
 * modules. The extractor is pure — disk I/O lives in `inspect.ts`.
 *
 * Strategy:
 * 1. Parse the spec text into an in-memory ts-morph project.
 * 2. Resolve the workspace `<Prefix>` plus the set of known
 *    `<prefix><Model>Context` function names. When the caller supplied them
 *    (from `inspectAppFixtures()`) we use those; otherwise we read the
 *    spec's own imports off `**\/test/fixture` and derive the prefix as the
 *    longest common camel-prefix of the `*Context` named imports.
 * 3. Detect locally-defined helper-describe functions (any top-level
 *    function/arrow whose body invokes `describe`/`it`).
 * 4. Walk the file's top-level expression statements; for each call
 *    expression, classify it (describe / it / hook / fixture / wrapper /
 *    helperCall) and recurse into its callback body. Recursion only follows
 *    arrow / function-expression bodies — leaf calls (`expect(...)`,
 *    `assertSnapshotData(...)`, etc.) are not descended into.
 */

import { Node, Project, SyntaxKind, type ArrowFunction, type Block, type CallExpression, type FunctionExpression, type Identifier, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
import type { HelperDescribe, PrefixSource, SpecFileTree, SpecNode } from './types.js';

/**
 * Inputs accepted by {@link extractSpecTreeFromText}.
 */
export interface ExtractSpecTreeInput {
  readonly text: string;
  readonly specPath: string;
  /**
   * Optional explicit prefix (e.g. `Hellosubs`). When supplied alongside
   * {@link knownFixtureNames}, no import-based detection is attempted.
   */
  readonly prefix?: string;
  /**
   * Optional explicit list of `<prefix><Model>Context` function names.
   * Typically supplied from the result of `inspectAppFixtures()`. When
   * non-empty, fixture-name matching is exact instead of suffix-based.
   */
  readonly knownFixtureNames?: readonly string[];
}

const SPEC_FILE_VIRTUAL_PATH = '__spec__/spec.ts';
const FIXTURE_CONTEXT_SUFFIX = 'Context';
const FIXTURE_FACTORY_SUFFIX = 'ContextFactory';
const HOOK_NAMES: ReadonlySet<string> = new Set(['beforeEach', 'beforeAll', 'afterEach', 'afterAll']);
const DESCRIBE_NAMES: ReadonlySet<string> = new Set(['describe', 'xdescribe', 'fdescribe']);
const IT_NAMES: ReadonlySet<string> = new Set(['it', 'xit', 'fit', 'test']);
/**
 * Pattern matching `itShould*` helper functions (e.g. `itShouldFail`,
 * `itShouldPass`). Such helpers wrap a real `it(...)` call and follow the
 * same `(title, body)` shape, so we treat them as it-equivalent — they
 * count toward {@link SpecFileTree.itCount} and surface in the `describes`,
 * `its`, and search views with their own callee identifier preserved.
 */
const IT_HELPER_PREFIX_PATTERN = /^itShould(?:[A-Z]|$)/;

function isItName(name: string): boolean {
  return IT_NAMES.has(name) || IT_HELPER_PREFIX_PATTERN.test(name);
}

/**
 * Pure entry point used by inspect.ts and tests. Parses the supplied spec
 * text and returns the structural tree; never touches disk.
 *
 * @param input - the raw spec text + caller-relative path metadata
 * @returns the parsed tree
 */
export function extractSpecTreeFromText(input: ExtractSpecTreeInput): SpecFileTree {
  const { text, specPath } = input;
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(SPEC_FILE_VIRTUAL_PATH, text, { overwrite: true });

  const { prefix, prefixSource, knownFixtureNames } = resolvePrefixAndFixtures(sourceFile, input);
  const helpers = collectHelpers(sourceFile);
  const helperNames = new Set(helpers.map((h) => h.name));

  const counts = { describe: 0, it: 0, fixture: 0 };
  const rootChildren: SpecNode[] = [];
  for (const stmt of sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(stmt)) continue;
    const expr = stmt.getExpression();
    if (!Node.isCallExpression(expr)) continue;
    const node = walkCall(expr, { prefix, knownFixtureNames, helperNames, counts });
    if (node !== undefined) {
      rootChildren.push(node);
    }
  }

  const lastLine = sourceFile.getEndLineNumber();
  const root: SpecNode = {
    kind: 'wrapper',
    callee: specPath,
    line: 1,
    endLine: lastLine,
    children: rootChildren
  };

  const result: SpecFileTree = {
    specPath,
    prefix,
    prefixSource,
    knownFixtureNames,
    root,
    helpers,
    fixtureCallsCount: counts.fixture,
    itCount: counts.it,
    describeCount: counts.describe
  };
  return result;
}

interface ResolvedPrefix {
  readonly prefix: string | undefined;
  readonly prefixSource: PrefixSource;
  readonly knownFixtureNames: readonly string[];
}

/**
 * Resolves the workspace prefix and the known set of
 * `<prefix><Model>Context` function names.
 *
 * Priority:
 * 1. Explicit `prefix` + `knownFixtureNames` from the caller (from
 *    `inspectAppFixtures()` when an `apiDir` was supplied).
 * 2. Named imports off `**\/test/fixture` in the spec file. The shared
 *    camel-prefix of the imported `*Context` names yields the workspace
 *    prefix.
 * 3. Neither — return `undefined` prefix and an empty known-name list. The
 *    walker still detects fixtures via the `*Context$` suffix heuristic but
 *    leaves `model` blank.
 *
 * @param sourceFile - the parsed spec file
 * @param input - the caller-supplied input (potentially carrying overrides)
 * @returns the resolved prefix metadata
 */
function resolvePrefixAndFixtures(sourceFile: SourceFile, input: ExtractSpecTreeInput): ResolvedPrefix {
  const supplied = input.knownFixtureNames ?? [];
  if (input.prefix !== undefined && input.prefix !== '' && supplied.length > 0) {
    const result: ResolvedPrefix = {
      prefix: input.prefix,
      prefixSource: 'apiDir',
      knownFixtureNames: dedupedSorted(supplied)
    };
    return result;
  }
  const imported = collectFixtureImports(sourceFile);
  if (imported.length > 0) {
    const detectedPrefix = detectPrefixFromImports(imported);
    const result: ResolvedPrefix = {
      prefix: detectedPrefix,
      prefixSource: 'imports',
      knownFixtureNames: dedupedSorted(imported)
    };
    return result;
  }
  const result: ResolvedPrefix = { prefix: undefined, prefixSource: 'unknown', knownFixtureNames: [] };
  return result;
}

/**
 * Returns named imports from any module specifier ending in
 * `test/fixture` (with or without a `.js`/`.ts` extension), filtered to
 * `*Context` identifiers and excluding `*ContextFactory` ones.
 *
 * @param sourceFile - the parsed spec file
 * @returns the deduplicated list of fixture-context import names
 */
function collectFixtureImports(sourceFile: SourceFile): string[] {
  const seen = new Set<string>();
  for (const decl of sourceFile.getImportDeclarations()) {
    const spec = decl.getModuleSpecifierValue();
    if (!matchesFixtureModulePath(spec)) continue;
    for (const named of decl.getNamedImports()) {
      const name = named.getName();
      if (!name.endsWith(FIXTURE_CONTEXT_SUFFIX)) continue;
      if (name.endsWith(FIXTURE_FACTORY_SUFFIX)) continue;
      if (!/^[a-z]/.test(name)) continue;
      seen.add(name);
    }
  }
  return [...seen];
}

/**
 * `true` when the import specifier points at the conventional fixture module
 * (anywhere ending in `test/fixture`, optionally with a `.js`/`.ts`
 * extension).
 *
 * @param spec - the import declaration's module specifier
 * @returns `true` when this looks like a fixture import
 */
function matchesFixtureModulePath(spec: string): boolean {
  return /(^|\/)test\/fixture(\.[a-z]+)?$/.test(spec);
}

/**
 * Derives the workspace prefix as the longest shared camel-prefix of the
 * imported fixture names. Each name has the trailing `Context` stripped
 * before comparison so model-specific suffixes don't pollute the result.
 * The first character is upper-cased to match the PascalCase form used in
 * fixture class names.
 *
 * @param names - the imported `*Context` function names
 * @returns the workspace prefix, or `undefined` if no shared prefix exists
 */
function detectPrefixFromImports(names: readonly string[]): string | undefined {
  if (names.length === 0) return undefined;
  const stems = names.map((n) => n.slice(0, n.length - FIXTURE_CONTEXT_SUFFIX.length));
  let common = stems[0];
  for (let i = 1; i < stems.length; i++) {
    common = sharedPrefix(common, stems[i]);
    if (common.length === 0) return undefined;
  }
  // Trim trailing characters until we land on a camel boundary so we don't
  // produce a half-token like "hello" when both names start with
  // "hellosubsX...".
  const camelEnd = trimToCamelBoundary(common);
  if (camelEnd.length === 0) return undefined;
  return camelEnd.charAt(0).toUpperCase() + camelEnd.slice(1);
}

function sharedPrefix(a: string, b: string): string {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a.charAt(i) === b.charAt(i)) i++;
  return a.slice(0, i);
}

/**
 * Trims `s` to the last camelCase boundary so we don't return a partial
 * token. e.g. `hellosubsAuth` → `hellosubs`. If no boundary is present the
 * full string is returned.
 *
 * @param s - the candidate prefix to trim
 * @returns the trimmed prefix
 */
function trimToCamelBoundary(s: string): string {
  for (let i = s.length - 1; i >= 0; i--) {
    if (/[A-Z]/.test(s.charAt(i))) {
      return s.slice(0, i);
    }
  }
  return s;
}

function dedupedSorted(names: readonly string[]): readonly string[] {
  return [...new Set(names)].sort();
}

interface WalkContext {
  readonly prefix: string | undefined;
  readonly knownFixtureNames: readonly string[];
  readonly helperNames: ReadonlySet<string>;
  readonly counts: { describe: number; it: number; fixture: number };
}

/**
 * Classifies one call expression and, when its kind warrants it, recurses
 * into the call's callback body to gather child structural nodes.
 *
 * @param call - the call expression being inspected
 * @param ctx - shared walk state
 * @returns the resulting node, or `undefined` if the call isn't structural
 */
function walkCall(call: CallExpression, ctx: WalkContext): SpecNode | undefined {
  const calleeName = getCalleeName(call);
  if (calleeName === undefined) return undefined;
  const line = call.getStartLineNumber();
  const endLine = call.getEndLineNumber();

  if (DESCRIBE_NAMES.has(calleeName)) {
    ctx.counts.describe += 1;
    return describeOrItNode('describe', call, calleeName, line, endLine, ctx);
  }
  if (isItName(calleeName)) {
    ctx.counts.it += 1;
    return describeOrItNode('it', call, calleeName, line, endLine, ctx);
  }
  if (HOOK_NAMES.has(calleeName)) {
    return hookNode(call, calleeName, line, endLine);
  }
  if (isKnownFixtureName(calleeName, ctx)) {
    ctx.counts.fixture += 1;
    return fixtureNode(call, calleeName, ctx, line, endLine);
  }
  if (ctx.helperNames.has(calleeName)) {
    return helperCallNode(call, calleeName, ctx, line, endLine);
  }
  // Generic wrapper — only register when there's a callback we can recurse
  // into. Plain leaf calls are dropped.
  const callback = findCallback(call);
  if (callback === undefined) return undefined;
  const wrapperChildren = walkCallbackBody(callback, ctx);
  const wrapper: SpecNode = { kind: 'wrapper', callee: calleeName, line, endLine, children: wrapperChildren };
  return wrapper;
}

/**
 * Returns `true` when {@link name} should be treated as a fixture-context
 * call. When the caller supplied an explicit known-name set, exact match is
 * required. Otherwise we fall back to the heuristic: `<prefix><Model>Context`
 * (or `<lower><Capitalized>Context` when the prefix is unknown).
 *
 * @param name - the callee identifier
 * @param ctx - shared walk state
 * @returns `true` when this is a fixture call
 */
function isKnownFixtureName(name: string, ctx: WalkContext): boolean {
  if (ctx.knownFixtureNames.length > 0) {
    return ctx.knownFixtureNames.includes(name);
  }
  if (!name.endsWith(FIXTURE_CONTEXT_SUFFIX)) return false;
  if (name.endsWith(FIXTURE_FACTORY_SUFFIX)) return false;
  if (!/^[a-z]/.test(name)) return false;
  if (ctx.prefix !== undefined) {
    const lowerPrefix = ctx.prefix.charAt(0).toLowerCase() + ctx.prefix.slice(1);
    if (!name.startsWith(lowerPrefix)) return false;
  }
  return true;
}

function describeOrItNode(kind: 'describe' | 'it', call: CallExpression, calleeName: string, line: number, endLine: number, ctx: WalkContext): SpecNode {
  const args = call.getArguments();
  const titleArg = args[0];
  const titleInfo = readTitle(titleArg);
  const callback = findCallback(call);
  const children = kind === 'describe' && callback !== undefined ? walkCallbackBody(callback, ctx) : [];
  const node: SpecNode = {
    kind,
    title: titleInfo.title,
    titleIsTemplate: titleInfo.titleIsTemplate || undefined,
    callee: calleeName === kind ? undefined : calleeName,
    line,
    endLine,
    children
  };
  return node;
}

function hookNode(_call: CallExpression, calleeName: string, line: number, endLine: number): SpecNode {
  const node: SpecNode = { kind: 'hook', title: calleeName, line, endLine, children: [] };
  return node;
}

function fixtureNode(call: CallExpression, calleeName: string, ctx: WalkContext, line: number, endLine: number): SpecNode {
  const args = call.getArguments();
  const argsObject = args[0];
  const parentVars = Node.isObjectLiteralExpression(argsObject) ? readParentVars(argsObject) : [];
  const callback = findCallback(call);
  const varName = callback !== undefined ? readCallbackVarName(callback) : undefined;
  const model = stripFixturePrefix(calleeName, ctx.prefix);
  const children = callback !== undefined ? walkCallbackBody(callback, ctx) : [];
  const node: SpecNode = {
    kind: 'fixture',
    callee: calleeName,
    model,
    varName,
    parentVars: parentVars.length > 0 ? parentVars : undefined,
    line,
    endLine,
    children
  };
  return node;
}

function helperCallNode(call: CallExpression, calleeName: string, ctx: WalkContext, line: number, endLine: number): SpecNode {
  const callback = findCallback(call);
  const children = callback !== undefined ? walkCallbackBody(callback, ctx) : [];
  const node: SpecNode = { kind: 'helperCall', callee: calleeName, line, endLine, children };
  return node;
}

/**
 * Strips the workspace prefix (and the trailing `Context`) from the given
 * fixture-context callee name to produce the bare PascalCase model name.
 *
 * @param name - the callee identifier (e.g. `hellosubsCountryContext`)
 * @param prefix - the resolved workspace prefix (e.g. `Hellosubs`)
 * @returns the model name (e.g. `Country`), or `undefined` when no prefix
 */
function stripFixturePrefix(name: string, prefix: string | undefined): string | undefined {
  if (!name.endsWith(FIXTURE_CONTEXT_SUFFIX)) return undefined;
  const stem = name.slice(0, name.length - FIXTURE_CONTEXT_SUFFIX.length);
  if (prefix === undefined || prefix === '') {
    if (stem.length === 0) return undefined;
    return stem.charAt(0).toUpperCase() + stem.slice(1);
  }
  const lower = prefix.charAt(0).toLowerCase() + prefix.slice(1);
  if (!stem.startsWith(lower)) return undefined;
  const model = stem.slice(lower.length);
  return model.length > 0 ? model : undefined;
}

interface TitleInfo {
  readonly title: string | undefined;
  readonly titleIsTemplate: boolean;
}

function readTitle(arg: Node | undefined): TitleInfo {
  if (arg === undefined) return { title: undefined, titleIsTemplate: false };
  if (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg)) {
    const result: TitleInfo = { title: arg.getLiteralText(), titleIsTemplate: false };
    return result;
  }
  if (Node.isTemplateExpression(arg)) {
    const result: TitleInfo = { title: arg.getText(), titleIsTemplate: true };
    return result;
  }
  const result: TitleInfo = { title: arg.getText(), titleIsTemplate: true };
  return result;
}

/**
 * Returns the trailing arrow- or function-expression argument that holds the
 * call's body. Used to recurse into describe/it/fixture/wrapper bodies.
 *
 * @param call - the call expression to inspect
 * @returns the callback node, or `undefined` when no callback is present
 */
function findCallback(call: CallExpression): ArrowFunction | FunctionExpression | undefined {
  const args = call.getArguments();
  for (let i = args.length - 1; i >= 0; i--) {
    const a = args[i];
    if (Node.isArrowFunction(a) || Node.isFunctionExpression(a)) {
      return a;
    }
  }
  return undefined;
}

function readCallbackVarName(callback: ArrowFunction | FunctionExpression): string | undefined {
  const params = callback.getParameters();
  if (params.length === 0) return undefined;
  const first = params[0];
  const nameNode = first.getNameNode();
  if (Node.isIdentifier(nameNode)) {
    return nameNode.getText();
  }
  return undefined;
}

/**
 * Reads the identifier-typed property values from an object literal — the
 * "parent fixture references" passed to a fixture-context call (e.g.
 * `{ f, sg, rd, bgb }` → `['f','sg','rd','bgb']`).
 *
 * Only direct identifier values are captured. Other expressions (arrays,
 * call results, literals) are skipped — they're not parent-fixture vars.
 *
 * @param obj - the first-arg object literal
 * @returns the captured identifier names, in source order
 */
function readParentVars(obj: ObjectLiteralExpression): readonly string[] {
  const out: string[] = [];
  for (const prop of obj.getProperties()) {
    if (Node.isShorthandPropertyAssignment(prop)) {
      out.push(prop.getName());
      continue;
    }
    if (Node.isPropertyAssignment(prop)) {
      const init = prop.getInitializer();
      if (init !== undefined && Node.isIdentifier(init)) {
        out.push((init as Identifier).getText());
      }
    }
  }
  return out;
}

/**
 * Recursively walks a callback body. Two body shapes are supported:
 * - block bodies: every top-level expression statement's call expression
 *   is classified.
 * - expression-bodied arrows: the single expression is classified directly.
 *
 * Nested expression statements inside other structural calls are reached
 * through the recursive `walkCall` invocation.
 *
 * @param callback - the arrow/function expression whose body to walk
 * @param ctx - shared walk state
 * @returns the structural child nodes detected in the body
 */
function walkCallbackBody(callback: ArrowFunction | FunctionExpression, ctx: WalkContext): readonly SpecNode[] {
  const body = callback.getBody();
  if (Node.isBlock(body)) {
    return walkBlock(body, ctx);
  }
  if (Node.isCallExpression(body)) {
    const child = walkCall(body, ctx);
    return child === undefined ? [] : [child];
  }
  return [];
}

function walkBlock(block: Block, ctx: WalkContext): readonly SpecNode[] {
  const children: SpecNode[] = [];
  for (const stmt of block.getStatements()) {
    if (!Node.isExpressionStatement(stmt)) continue;
    const expr = stmt.getExpression();
    if (!Node.isCallExpression(expr)) continue;
    const child = walkCall(expr, ctx);
    if (child !== undefined) {
      children.push(child);
    }
  }
  return children;
}

function getCalleeName(call: CallExpression): string | undefined {
  const expr = call.getExpression();
  if (Node.isIdentifier(expr)) return expr.getText();
  // Unsupported callee shape (e.g. `obj.method(...)`).
  return undefined;
}

/**
 * Walks the spec file's top-level functions and arrow-function constants,
 * registering each whose body invokes `describe`/`it` as a helper-describe.
 *
 * @param sourceFile - the parsed spec file
 * @returns the helper list, in source order
 */
function collectHelpers(sourceFile: SourceFile): readonly HelperDescribe[] {
  const out: HelperDescribe[] = [];
  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName();
    if (name === undefined) continue;
    const usage = scanForDescribeOrIt(fn);
    if (!usage.emitsDescribe && !usage.emitsIt) continue;
    out.push({ name, line: fn.getStartLineNumber(), endLine: fn.getEndLineNumber(), emitsDescribe: usage.emitsDescribe, emitsIt: usage.emitsIt });
  }
  for (const v of sourceFile.getVariableStatements()) {
    for (const decl of v.getDeclarations()) {
      const init = decl.getInitializer();
      if (init === undefined) continue;
      if (!Node.isArrowFunction(init) && !Node.isFunctionExpression(init)) continue;
      const usage = scanForDescribeOrIt(init);
      if (!usage.emitsDescribe && !usage.emitsIt) continue;
      out.push({ name: decl.getName(), line: decl.getStartLineNumber(), endLine: decl.getEndLineNumber(), emitsDescribe: usage.emitsDescribe, emitsIt: usage.emitsIt });
    }
  }
  return out;
}

interface DescribeOrItUsage {
  emitsDescribe: boolean;
  emitsIt: boolean;
}

function scanForDescribeOrIt(node: Node): DescribeOrItUsage {
  const usage: DescribeOrItUsage = { emitsDescribe: false, emitsIt: false };
  node.forEachDescendant((descendant) => {
    if (descendant.getKind() !== SyntaxKind.CallExpression) return;
    const call = descendant as CallExpression;
    const expr = call.getExpression();
    if (!Node.isIdentifier(expr)) return;
    const name = expr.getText();
    if (DESCRIBE_NAMES.has(name)) usage.emitsDescribe = true;
    if (isItName(name)) usage.emitsIt = true;
  });
  return usage;
}
