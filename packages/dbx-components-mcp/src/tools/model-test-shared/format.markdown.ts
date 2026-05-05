/**
 * Markdown formatters for the `dbx_model_test_*` tool cluster.
 *
 * The tree formatter renders one of the requested {@link SpecTreeView}
 * variants. The search formatter renders match lists for the four query
 * modes. Both share a small node-line renderer so the output is consistent.
 */

import type { HelperDescribe, SpecFileTree, SpecNode, SpecSearchHit, SpecSearchResult, SpecTreeFilters, SpecTreeView } from './types.js';

const INDENT = '  ';

/**
 * Renders the tree report for `dbx_model_test_tree`.
 *
 * @param tree - the parsed spec tree
 * @param view - the requested view (defaults to `all`)
 * @param filters - optional model / describe-path filters
 * @returns the markdown body
 */
export function formatTreeAsMarkdown(tree: SpecFileTree, view: SpecTreeView = 'all', filters: SpecTreeFilters = {}): string {
  const lines: string[] = [];
  appendHeader({ lines, tree, view, filters });
  if (view === 'helpers') {
    appendHelpersSection(lines, tree.helpers);
    return lines.join('\n');
  }
  if (view === 'its') {
    appendItIndex(lines, tree);
    return lines.join('\n');
  }
  const filteredRoot = applyFilters(tree.root, view, filters);
  if (filteredRoot.children.length === 0) {
    lines.push('', '_No matching nodes._');
    return lines.join('\n');
  }
  lines.push('', `## Tree (view: ${view})`);
  if (filters.filterByModel) lines.push(`Filter — model: \`${filters.filterByModel}\``);
  if (filters.filterByDescribePath) lines.push(`Filter — describePath: \`${filters.filterByDescribePath}\``);
  lines.push('');
  for (const child of filteredRoot.children) {
    appendNode(lines, child, 0);
  }
  return lines.join('\n');
}

/**
 * Renders the search report for `dbx_model_test_search`.
 *
 * @param tree - the parsed spec tree (used for the header)
 * @param result - the search outcome
 * @returns the markdown body
 */
export function formatSearchAsMarkdown(tree: SpecFileTree, result: SpecSearchResult): string {
  const lines: string[] = [`# Spec search — ${tree.specPath}`, '', `Query: \`${result.query.mode}\` = \`${result.query.value}\``, `Matches: ${result.hits.length}`];
  if (result.hits.length === 0) {
    lines.push('', '_No matches._');
    return lines.join('\n');
  }
  lines.push('');
  for (const hit of result.hits) {
    appendHit(lines, hit);
  }
  return lines.join('\n');
}

interface AppendHeaderInput {
  readonly lines: string[];
  readonly tree: SpecFileTree;
  readonly view: SpecTreeView;
  readonly filters: SpecTreeFilters;
}

function appendHeader(input: AppendHeaderInput): void {
  const { lines, tree, view, filters } = input;
  lines.push(`# Spec tree — ${tree.specPath}`, '', `Detected workspace prefix: \`${tree.prefix ?? '(none)'}\` (source: ${tree.prefixSource})`, `Counts: ${tree.describeCount} describes, ${tree.itCount} its, ${tree.fixtureCallsCount} fixture calls, ${tree.helpers.length} helper-describes`);
  if (view !== 'helpers' && view !== 'its' && (filters.filterByModel || filters.filterByDescribePath)) {
    const modelFilter = filters.filterByModel ? `model=\`${filters.filterByModel}\`` : '';
    const describeFilter = filters.filterByDescribePath ? `describePath=\`${filters.filterByDescribePath}\`` : '';
    const activeFilters = [modelFilter, describeFilter].filter(Boolean).join(', ');
    lines.push(`Active filters: ${activeFilters}`);
  }
}

function appendHelpersSection(lines: string[], helpers: readonly HelperDescribe[]): void {
  lines.push('', `## Helpers (${helpers.length})`);
  if (helpers.length === 0) {
    lines.push('', '_No helper-describes detected._');
    return;
  }
  lines.push('', '| Name | Emits | Lines |', '|---|---|---|');
  for (const h of helpers) {
    const emits: string[] = [];
    if (h.emitsDescribe) emits.push('describe');
    if (h.emitsIt) emits.push('it');
    lines.push(`| \`${h.name}\` | ${emits.join(', ')} | ${h.line}–${h.endLine} |`);
  }
}

function appendItIndex(lines: string[], tree: SpecFileTree): void {
  const its: { describePath: string[]; node: SpecNode }[] = [];
  const stack: string[] = [];
  const collect = (node: SpecNode): void => {
    if (node.kind === 'it') {
      its.push({ describePath: [...stack], node });
    }
    let pushed = false;
    if (node.kind === 'describe' && node.title !== undefined) {
      stack.push(node.title);
      pushed = true;
    }
    for (const child of node.children) collect(child);
    if (pushed) stack.pop();
  };
  for (const c of tree.root.children) collect(c);

  lines.push('', `## Tests (${its.length})`);
  if (its.length === 0) {
    lines.push('', '_No `it` calls detected._');
    return;
  }
  lines.push('');
  for (const { describePath, node } of its) {
    const path = describePath.length > 0 ? `${describePath.join(' > ')} > ` : '';
    const title = describeOrItTitle(node);
    const callee = node.callee !== undefined ? ` _(via \`${node.callee}\`)_` : '';
    lines.push(`- ${path}${title}${callee} [L${node.line}]`);
  }
}

function appendHit(lines: string[], hit: SpecSearchHit): void {
  const label = hitLabel(hit);
  const extras: string[] = [];
  if (hit.describePath.length > 0) {
    const describes = hit.describePath.map((s) => `\`${s}\``).join(' > ');
    extras.push(`${INDENT}describes: ${describes}`);
  }
  if (hit.fixtureChain.length > 0) {
    const fixtures = hit.fixtureChain.map((s) => `\`${s}\``).join(' > ');
    extras.push(`${INDENT}fixtures: ${fixtures}`);
  }
  lines.push(`- ${label} [L${hit.line}–${hit.endLine}]`, ...extras);
}

function hitLabel(hit: SpecSearchHit): string {
  switch (hit.kind) {
    case 'fixture':
      return `**fixture** \`${hit.callee ?? '?'}\` → \`${hit.model ?? '?'}\``;
    case 'describe':
      return `**${hit.callee ?? 'describe'}** \`${hit.title ?? '?'}\``;
    case 'it':
      return `**${hit.callee ?? 'it'}** \`${hit.title ?? '?'}\``;
    case 'helperCall':
      return `**helperCall** \`${hit.callee ?? '?'}\``;
    case 'wrapper':
      return `**wrapper** \`${hit.callee ?? '?'}\``;
    case 'hook':
      return `**${hit.title ?? 'hook'}**`;
    default:
      return '**?**';
  }
}

function appendNode(lines: string[], node: SpecNode, depth: number): void {
  const indent = INDENT.repeat(depth);
  lines.push(`${indent}- ${nodeLabel(node)} [L${node.line}–${node.endLine}]`);
  for (const child of node.children) {
    appendNode(lines, child, depth + 1);
  }
}

function describeOrItTitle(node: SpecNode & { readonly kind: 'describe' | 'it' }): string {
  if (node.title === undefined) return '_(no title)_';
  if (node.titleIsTemplate) return `\`${node.title}\` _(template)_`;
  return `\`${node.title}\``;
}

function nodeLabel(node: SpecNode): string {
  switch (node.kind) {
    case 'describe':
      return `**${node.callee ?? 'describe'}** ${describeOrItTitle(node)}`;
    case 'it':
      return `**${node.callee ?? 'it'}** ${describeOrItTitle(node)}`;
    case 'hook':
      return `**${node.title ?? 'hook'}**`;
    case 'fixture': {
      const var_ = node.varName !== undefined ? ` _(as \`${node.varName}\`)_` : '';
      const parents = node.parentVars && node.parentVars.length > 0 ? ` deps: \`${node.parentVars.join(', ')}\`` : '';
      return `**fixture** \`${node.callee ?? '?'}\` → \`${node.model ?? '?'}\`${var_}${parents}`;
    }
    case 'wrapper':
      return `**wrapper** \`${node.callee ?? '?'}\``;
    case 'helperCall':
      return `**helperCall** \`${node.callee ?? '?'}\``;
    default:
      return '**?**';
  }
}

/**
 * Applies the requested view + filter combination to the root node and
 * returns a new {@link SpecNode} tree. The original tree is not mutated.
 *
 * View semantics:
 * - `all` — keep every node.
 * - `describes` — drop `fixture` and `wrapper` nodes; their children fold
 *   up into the parent.
 * - `fixtures` — keep only `fixture` nodes; everything else folds away.
 *
 * Filter semantics:
 * - `filterByModel` — prune subtrees that don't transitively contain a
 *   `fixture` whose model matches (case-insensitive).
 * - `filterByDescribePath` — keep only the deepest subtree whose ancestor
 *   describe-path equals or starts with the supplied `>`-delimited path.
 *
 * @param root - the root node from the parsed tree
 * @param view - the requested view
 * @param filters - the optional model / describe-path filters
 * @returns a new root node with the view + filters applied
 */
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
