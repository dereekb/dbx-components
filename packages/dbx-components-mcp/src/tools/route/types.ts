/**
 * Shared types for the route cluster (`dbx_route_tree`, `dbx_route_lookup`,
 * `dbx_route_search`).
 *
 * The cluster is validator-style: tools read TypeScript source on each call
 * and extract the UIRouter state tree by syntactic analysis. No DI graph
 * evaluation; we record class-name references as strings.
 *
 * Routes are described as a flat list of {@link RouteNode}s during extraction
 * and turned into a parent-linked {@link RouteTree} by `build-tree.ts`.
 */

/**
 * One file's raw contents passed into the route extractor. Callers reading
 * paths or globs off disk resolve them to this shape before calling into the
 * core.
 */
export interface RouteSource {
  readonly name: string;
  readonly text: string;
}

/**
 * Stable issue codes so consumers can suppress or interpret individual
 * findings without string-matching the message text.
 */
export type RouteIssueCode = 'DUPLICATE_STATE_NAME' | 'CYCLE_DETECTED' | 'ORPHAN_STATE' | 'UNRESOLVED_COMPONENT' | 'DYNAMIC_STATE_NAME' | 'NO_STATES_FOUND';

/**
 * Severity of a route issue. Errors fail the tool call (`isError: true`);
 * warnings are surfaced but the tree still renders.
 */
export type RouteIssueSeverity = 'error' | 'warning' | 'info';

export interface RouteIssue {
  readonly code: RouteIssueCode;
  readonly severity: RouteIssueSeverity;
  readonly message: string;
  readonly file: string | undefined;
  readonly line: number | undefined;
  readonly stateName: string | undefined;
}

/**
 * A single state declaration extracted from a `Ng2StateDeclaration` object
 * literal. Field names mirror UIRouter's state-config shape; `name` is always
 * populated, every other field is optional.
 *
 * `name` may carry a trailing `.**` (UIRouter future-state marker). We keep it
 * verbatim for fidelity but strip the marker when computing parent linkage.
 */
export interface RouteNode {
  readonly name: string;
  readonly url: string | undefined;
  readonly component: string | undefined;
  /** Explicit `parent` field if set; otherwise undefined (parent is derived from the dot-prefix of `name`). */
  readonly explicitParent: string | undefined;
  readonly redirectTo: string | undefined;
  readonly abstract: boolean;
  /** `name` ends with `.**` — UIRouter lazy/future-state marker. */
  readonly futureState: boolean;
  /** Names of declared params (object keys only). */
  readonly paramKeys: readonly string[];
  /** Names of declared resolves (object keys, or array element identifiers). */
  readonly resolveKeys: readonly string[];
  /** Source file the state was defined in. */
  readonly file: string;
  readonly line: number;
}

/**
 * A node in the resolved {@link RouteTree}. Children are linked by a parent
 * pass; the original {@link RouteNode} is preserved on `data`.
 */
export interface RouteTreeNode {
  readonly data: RouteNode;
  /** Composed URL from root → this node, or `undefined` if any segment is missing. */
  readonly fullUrl: string | undefined;
  readonly parent: RouteTreeNode | undefined;
  readonly children: readonly RouteTreeNode[];
}

export interface RouteTree {
  /** Top-level nodes (no resolvable parent in the source set). */
  readonly roots: readonly RouteTreeNode[];
  /** Every node, indexed by state name. */
  readonly byName: ReadonlyMap<string, RouteTreeNode>;
  /** Issues surfaced during extraction or tree building. */
  readonly issues: readonly RouteIssue[];
  /** Files actually parsed (after import-walking). */
  readonly filesChecked: number;
  /** Total nodes in the tree. */
  readonly nodeCount: number;
}
