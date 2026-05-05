/**
 * JSON formatters for the `dbx_model_test_*` tool cluster.
 *
 * The tree formatter returns either the full parsed tree or one of the
 * filtered views; the search formatter returns the search result verbatim.
 * Both produce stable JSON suitable for downstream tooling.
 */

import type { SpecFileTree, SpecNode, SpecSearchResult, SpecTreeFilters, SpecTreeView } from './types.js';

interface ItIndexEntry {
  readonly describePath: readonly string[];
  readonly title: string | undefined;
  readonly titleIsTemplate?: boolean;
  /**
   * The callee identifier when the `it` came from a non-default helper
   * (e.g. `itShouldFail`, `xit`, `fit`). `undefined` for plain `it(...)`.
   */
  readonly callee?: string;
  readonly line: number;
  readonly endLine: number;
}

/**
 * Renders the tree report for `dbx_model_test_tree` in JSON form.
 *
 * @param tree - the parsed spec tree
 * @param view - the requested view
 * @param filters - optional model / describe-path filters
 * @returns the JSON body
 */
export function formatTreeAsJson(tree: SpecFileTree, view: SpecTreeView = 'all', filters: SpecTreeFilters = {}): string {
  if (view === 'helpers') {
    const result = { specPath: tree.specPath, prefix: tree.prefix, prefixSource: tree.prefixSource, helpers: tree.helpers };
    return JSON.stringify(result, null, 2);
  }
  if (view === 'its') {
    const its = collectIts(tree);
    const result = { specPath: tree.specPath, prefix: tree.prefix, prefixSource: tree.prefixSource, its };
    return JSON.stringify(result, null, 2);
  }
  const filteredRoot = applyFilters(tree.root, view, filters);
  const result = { specPath: tree.specPath, prefix: tree.prefix, prefixSource: tree.prefixSource, knownFixtureNames: tree.knownFixtureNames, view, filters, counts: { describes: tree.describeCount, its: tree.itCount, fixtures: tree.fixtureCallsCount, helpers: tree.helpers.length }, root: filteredRoot };
  return JSON.stringify(result, null, 2);
}

/**
 * Renders the search report for `dbx_model_test_search` in JSON form.
 *
 * @param tree - the parsed spec tree (used for the wrapper metadata)
 * @param result - the search outcome
 * @returns the JSON body
 */
export function formatSearchAsJson(tree: SpecFileTree, result: SpecSearchResult): string {
  const payload = { specPath: tree.specPath, prefix: tree.prefix, prefixSource: tree.prefixSource, query: result.query, hits: result.hits };
  return JSON.stringify(payload, null, 2);
}

function collectIts(tree: SpecFileTree): readonly ItIndexEntry[] {
  const out: ItIndexEntry[] = [];
  const stack: string[] = [];
  const visit = (node: SpecNode): void => {
    if (node.kind === 'it') {
      const entry: ItIndexEntry = { describePath: [...stack], title: node.title, titleIsTemplate: node.titleIsTemplate, callee: node.callee, line: node.line, endLine: node.endLine };
      out.push(entry);
    }
    let pushed = false;
    if (node.kind === 'describe' && node.title !== undefined) {
      stack.push(node.title);
      pushed = true;
    }
    for (const child of node.children) visit(child);
    if (pushed) stack.pop();
  };
  for (const c of tree.root.children) visit(c);
  return out;
}

function applyViewToRoot(root: SpecNode, view: SpecTreeView): SpecNode {
  if (view === 'describes') return collapseTo(root, ['describe', 'it', 'hook', 'helperCall']);
  if (view === 'fixtures') return collapseTo(root, ['fixture']);
  return root;
}

function applyFilters(root: SpecNode, view: SpecTreeView, filters: SpecTreeFilters): SpecNode {
  let next = applyViewToRoot(root, view);
  if (filters.filterByModel !== undefined && filters.filterByModel !== '') {
    next = pruneByModel(next, filters.filterByModel.toLowerCase()) ?? { ...next, children: [] };
  }
  if (filters.filterByDescribePath !== undefined && filters.filterByDescribePath !== '') {
    next = pruneByDescribePath(next, parseDescribePath(filters.filterByDescribePath)) ?? { ...next, children: [] };
  }
  return next;
}

function collapseTo(node: SpecNode, keep: readonly string[]): SpecNode {
  const collapsedChildren: SpecNode[] = [];
  for (const child of node.children) {
    const transformed = collapseTo(child, keep);
    if (keep.includes(child.kind)) {
      collapsedChildren.push(transformed);
    } else {
      collapsedChildren.push(...transformed.children);
    }
  }
  return { ...node, children: collapsedChildren };
}

function pruneByModel(node: SpecNode, model: string): SpecNode | undefined {
  const matchedSelf = node.kind === 'fixture' && node.model?.toLowerCase() === model;
  const prunedChildren: SpecNode[] = [];
  for (const child of node.children) {
    const result = pruneByModel(child, model);
    if (result !== undefined) prunedChildren.push(result);
  }
  if (matchedSelf || prunedChildren.length > 0) {
    return { ...node, children: prunedChildren };
  }
  return undefined;
}

function pruneByDescribePath(node: SpecNode, path: readonly string[]): SpecNode | undefined {
  if (path.length === 0) return node;
  const matched: SpecNode[] = [];
  collectDescribesMatching({ node, target: path, stack: [], out: matched });
  if (matched.length === 0) return undefined;
  return { ...node, children: matched };
}

interface CollectDescribesMatchingInput {
  readonly node: SpecNode;
  readonly target: readonly string[];
  readonly stack: string[];
  readonly out: SpecNode[];
}

function collectDescribesMatching(input: CollectDescribesMatchingInput): void {
  const { node, target, stack, out } = input;
  if (node.kind === 'describe' && node.title !== undefined) {
    stack.push(node.title.toLowerCase());
    if (pathStartsWith(stack, target)) {
      out.push(node);
      stack.pop();
      return;
    }
  }
  for (const child of node.children) collectDescribesMatching({ node: child, target, stack, out });
  if (node.kind === 'describe' && node.title !== undefined) stack.pop();
}

function pathStartsWith(actual: readonly string[], expected: readonly string[]): boolean {
  if (expected.length > actual.length) return false;
  for (const [i, element] of expected.entries()) {
    if (!actual[i].includes(element)) return false;
  }
  return true;
}

function parseDescribePath(value: string): readonly string[] {
  return value
    .split('>')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}
