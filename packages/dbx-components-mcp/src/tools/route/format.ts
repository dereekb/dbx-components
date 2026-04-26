/**
 * Renderers for {@link RouteTree} — markdown / json / flat.
 *
 * The markdown renderer is the default for `dbx_route_tree`; flat is useful
 * for piping into grep; json is for programmatic consumption.
 */

import type { RouteIssue, RouteTree, RouteTreeNode } from './types.js';

export type RouteTreeFormat = 'markdown' | 'json' | 'flat';

export interface FormatRouteTreeArgs {
  readonly tree: RouteTree;
  readonly format: RouteTreeFormat;
  readonly depthLimit: number | undefined;
  readonly title: string;
}

/**
 * Renders a route tree in the caller-requested format (markdown, json, flat).
 * Centralising the dispatch here means callers pass the same args shape no
 * matter which output mode they need.
 *
 * @param args - the tree, format, depth limit, and title to render
 * @returns the rendered tree string
 */
export function formatRouteTree(args: FormatRouteTreeArgs): string {
  const { format } = args;
  let result: string;
  switch (format) {
    case 'markdown':
      result = renderMarkdown(args);
      break;
    case 'json':
      result = renderJson(args);
      break;
    case 'flat':
      result = renderFlat(args);
      break;
  }
  return result;
}

// MARK: Markdown
function renderMarkdown(args: FormatRouteTreeArgs): string {
  const { tree, depthLimit, title } = args;
  const lines: string[] = [];
  lines.push(`# State tree (${title})`);
  lines.push('');
  lines.push(`${tree.nodeCount} state(s) across ${tree.filesChecked} file(s).`);
  if (tree.roots.length === 0) {
    lines.push('');
    lines.push('_No states found._');
  } else {
    lines.push('');
    for (const root of tree.roots) {
      renderMarkdownNode({ node: root, depth: 0, depthLimit, lines });
    }
  }
  appendIssuesSection(lines, tree.issues);
  return lines.join('\n');
}

/**
 * Options for rendering a route tree node as markdown.
 */
interface RenderMarkdownNodeOptions {
  readonly node: RouteTreeNode;
  readonly depth: number;
  readonly depthLimit: number | undefined;
  readonly lines: string[];
}

function renderMarkdownNode(options: RenderMarkdownNodeOptions): void {
  const { node, depth, depthLimit, lines } = options;
  if (depthLimit !== undefined && depth > depthLimit) {
    return;
  }
  const indent = '  '.repeat(depth);
  const url = node.data.url ?? '_no url_';
  const component = node.data.component ?? '_no component_';
  const flags: string[] = [];
  if (node.data.abstract) flags.push('abstract');
  if (node.data.futureState) flags.push('future');
  if (node.data.redirectTo) flags.push(`→ ${node.data.redirectTo}`);
  const suffix = flags.length > 0 ? ` _(${flags.join(', ')})_` : '';
  lines.push(`${indent}- **${node.data.name}** \`${url}\` → \`${component}\`${suffix}`);
  if (depthLimit !== undefined && depth + 1 > depthLimit) {
    if (node.children.length > 0) {
      lines.push(`${indent}  - _…${node.children.length} child state(s) hidden by depth_limit_`);
    }
    return;
  }
  for (const child of node.children) {
    renderMarkdownNode({ node: child, depth: depth + 1, depthLimit, lines });
  }
}

// MARK: JSON
interface SerializableNode {
  readonly name: string;
  readonly url: string | undefined;
  readonly fullUrl: string | undefined;
  readonly component: string | undefined;
  readonly explicitParent: string | undefined;
  readonly redirectTo: string | undefined;
  readonly abstract: boolean;
  readonly futureState: boolean;
  readonly paramKeys: readonly string[];
  readonly resolveKeys: readonly string[];
  readonly file: string;
  readonly line: number;
  readonly children: readonly SerializableNode[];
}

function renderJson(args: FormatRouteTreeArgs): string {
  const { tree, depthLimit } = args;
  const roots: SerializableNode[] = tree.roots.map((root) => toSerializable(root, 0, depthLimit));
  const payload = {
    nodeCount: tree.nodeCount,
    filesChecked: tree.filesChecked,
    roots,
    issues: tree.issues
  };
  return JSON.stringify(payload, null, 2);
}

function toSerializable(node: RouteTreeNode, depth: number, depthLimit: number | undefined): SerializableNode {
  const includeChildren = depthLimit === undefined || depth + 1 <= depthLimit;
  const children: SerializableNode[] = includeChildren ? node.children.map((c) => toSerializable(c, depth + 1, depthLimit)) : [];
  const result: SerializableNode = {
    name: node.data.name,
    url: node.data.url,
    fullUrl: node.fullUrl,
    component: node.data.component,
    explicitParent: node.data.explicitParent,
    redirectTo: node.data.redirectTo,
    abstract: node.data.abstract,
    futureState: node.data.futureState,
    paramKeys: node.data.paramKeys,
    resolveKeys: node.data.resolveKeys,
    file: node.data.file,
    line: node.data.line,
    children
  };
  return result;
}

// MARK: Flat
function renderFlat(args: FormatRouteTreeArgs): string {
  const { tree, depthLimit, title } = args;
  const lines: string[] = [];
  lines.push(`# Flat state listing (${title})`);
  lines.push('');
  if (tree.nodeCount === 0) {
    lines.push('_No states found._');
  } else {
    walkFlat({ nodes: tree.roots, depth: 0, depthLimit, lines });
  }
  appendIssuesSection(lines, tree.issues);
  return lines.join('\n');
}

/**
 * Options for emitting a flat list of route nodes.
 */
interface WalkFlatOptions {
  readonly nodes: readonly RouteTreeNode[];
  readonly depth: number;
  readonly depthLimit: number | undefined;
  readonly lines: string[];
}

function walkFlat(options: WalkFlatOptions): void {
  const { nodes, depth, depthLimit, lines } = options;
  if (depthLimit !== undefined && depth > depthLimit) {
    return;
  }
  for (const node of nodes) {
    const url = node.fullUrl ?? '(no url)';
    const component = node.data.component ?? '(no component)';
    lines.push(`${node.data.name}\t${url}\t${component}`);
    walkFlat({ nodes: node.children, depth: depth + 1, depthLimit, lines });
  }
}

// MARK: Issues section
function appendIssuesSection(lines: string[], issues: readonly RouteIssue[]): void {
  if (issues.length === 0) {
    return;
  }
  lines.push('', '## Issues', '');
  for (const issue of issues) {
    const label = issue.severity === 'error' ? 'ERROR' : issue.severity === 'warning' ? 'WARN' : 'INFO';
    const linePart = issue.line === undefined ? '' : `:${issue.line}`;
    const where = issue.file === undefined ? 'extraction' : `${issue.file}${linePart}`;
    lines.push(`- **[${label}] ${issue.code}** _(${where})_ — ${issue.message}`);
  }
}
