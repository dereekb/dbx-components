/**
 * Types shared by the `dbx_model_test_*` tool cluster.
 *
 * The cluster reads a single `.spec.ts` file from a downstream API app and
 * parses its structural skeleton: nested `describe`/`it` calls, the
 * `<prefix><Model>Context(...)` fixture-context calls, locally-defined
 * helper-describe functions, and the wrapper calls (e.g.
 * `describeCallableRequestTest`, `<prefix>FunctionContextFactory`) that sit
 * between them.
 *
 * The extractor returns the full {@link SpecFileTree}. Per-view filtering
 * and search live in their own modules so the parser stays pure.
 */

/**
 * The kind of node detected at a call site inside a spec file.
 *
 * - `describe` — `describe(...)` / `xdescribe(...)` / `fdescribe(...)`
 * - `it` — `it(...)` / `xit(...)` / `fit(...)` / `test(...)`
 * - `hook` — `beforeEach` / `beforeAll` / `afterEach` / `afterAll`
 * - `fixture` — a `<prefix><Model>Context(...)` test-context-fixture call
 * - `wrapper` — any other call that takes a trailing arrow / function
 *   callback (e.g. `describeCallableRequestTest`,
 *   `<prefix>FunctionContextFactory`); rendered as a transparent layer
 * - `helperCall` — a call to a function declared in this same file that
 *   itself emits `describe`/`it` calls
 */
export type SpecNodeKind = 'describe' | 'it' | 'hook' | 'fixture' | 'wrapper' | 'helperCall';

/**
 * One structural node detected in a spec file.
 *
 * `line`/`endLine` are 1-based line numbers from ts-morph and bracket the
 * call expression itself (not just its callback body) — they're what callers
 * use to navigate.
 */
export interface SpecNode {
  readonly kind: SpecNodeKind;
  /**
   * Title for `describe`/`it`/`hook` nodes. `undefined` when the call has no
   * string title (e.g. `beforeEach`) or when the title is a non-trivial
   * expression — see {@link titleIsTemplate}.
   */
  readonly title?: string | undefined;
  /**
   * `true` when the title was a template literal or non-string-literal
   * expression and the value reported in {@link title} is a textual
   * approximation. Callers can use this flag to avoid asserting against the
   * value.
   */
  readonly titleIsTemplate?: boolean | undefined;
  /**
   * Bare PascalCase model name for `fixture` nodes (e.g. `Country`).
   * `undefined` when the prefix could not be resolved.
   */
  readonly model?: string | undefined;
  /**
   * The variable name bound by the fixture's callback parameter
   * (e.g. `(rc) => ...` → `rc`). Only populated for `fixture` nodes.
   */
  readonly varName?: string | undefined;
  /**
   * Identifier names that appear as values in the fixture's first-arg object
   * (e.g. `{ f, sg, rd, bgb }` → `['f','sg','rd','bgb']`). These map to
   * parent-fixture variables — the dependency hint that lets callers see
   * which contexts a fixture relies on.
   */
  readonly parentVars?: readonly string[] | undefined;
  /**
   * Identifier name for `wrapper` and `helperCall` nodes (the function being
   * called).
   */
  readonly callee?: string | undefined;
  /**
   * 1-based line number of the call expression's first character.
   */
  readonly line: number;
  /**
   * 1-based line number of the call expression's last character.
   */
  readonly endLine: number;
  /**
   * Child nodes detected inside this node's callback body. Empty for `it`
   * and `hook` nodes (their body is leaf code).
   */
  readonly children: readonly SpecNode[];
}

/**
 * One locally-defined helper function that emits `describe`/`it` calls when
 * invoked. Detected by walking top-level function declarations and
 * arrow-function constants.
 */
export interface HelperDescribe {
  readonly name: string;
  readonly line: number;
  readonly endLine: number;
  readonly emitsDescribe: boolean;
  readonly emitsIt: boolean;
}

/**
 * How the workspace prefix used to detect fixture functions was obtained.
 *
 * - `apiDir` — caller supplied an `apiDir` and the prefix came from
 *   `inspectAppFixtures()` against `<apiDir>/src/test/fixture.ts`.
 * - `imports` — extracted from the spec file's own import statements
 *   (named imports off `**\/test/fixture`).
 * - `unknown` — neither source resolved a prefix; fixture nodes are still
 *   detected via the `*Context$` suffix heuristic but `model` may be empty.
 */
export type PrefixSource = 'apiDir' | 'imports' | 'unknown';

/**
 * Aggregate result returned by the extractor.
 *
 * The `root` node always has kind `wrapper` and represents the spec file
 * itself; its children are the top-level statements of the file.
 */
export interface SpecFileTree {
  readonly specPath: string;
  readonly prefix?: string | undefined;
  readonly prefixSource: PrefixSource;
  readonly knownFixtureNames: readonly string[];
  readonly root: SpecNode;
  readonly helpers: readonly HelperDescribe[];
  readonly fixtureCallsCount: number;
  readonly itCount: number;
  readonly describeCount: number;
}

/**
 * View modes accepted by `dbx_model_test_tree`.
 */
export type SpecTreeView = 'all' | 'describes' | 'fixtures' | 'its' | 'helpers';

/**
 * Optional filters accepted by `dbx_model_test_tree`.
 */
export interface SpecTreeFilters {
  readonly filterByModel?: string | undefined;
  readonly filterByDescribePath?: string | undefined;
}

/**
 * One mutually-exclusive query accepted by `dbx_model_test_search`.
 */
export type SpecSearchQuery = { readonly mode: 'model'; readonly value: string } | { readonly mode: 'chain'; readonly value: string } | { readonly mode: 'describe'; readonly value: string } | { readonly mode: 'it'; readonly value: string };

/**
 * One match returned by the search tool.
 *
 * `describePath` lists the describe titles from the spec root down to the
 * matched node (excluding the matched describe's own title).
 *
 * `fixtureChain` lists the model names of every `fixture` ancestor from
 * the spec root down to the matched node — i.e. the data-setup chain that
 * a test sitting at this position would inherit.
 */
export interface SpecSearchHit {
  readonly kind: SpecNodeKind;
  readonly title?: string | undefined;
  readonly model?: string | undefined;
  readonly callee?: string | undefined;
  readonly line: number;
  readonly endLine: number;
  readonly describePath: readonly string[];
  readonly fixtureChain: readonly string[];
}

/**
 * Result returned by `searchSpecTree()`.
 */
export interface SpecSearchResult {
  readonly query: SpecSearchQuery;
  readonly hits: readonly SpecSearchHit[];
}
