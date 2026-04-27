/**
 * Pure entry point for the route cluster. The MCP wrappers in
 * `../route-tree.tool.ts`, `../route-lookup.tool.ts`, and
 * `../route-search.tool.ts` all funnel into {@link loadRouteTree}.
 *
 * The wrapper is responsible for fs/glob I/O — this module receives a list of
 * {@link RouteSource} records and produces a normalized {@link RouteTree}.
 */

import { buildRouteTree } from './build-tree.js';
import { resolveRouteSources } from './resolve.js';
import type { RouteSource, RouteTree } from './types.js';

export interface LoadRouteTreeArgs {
  readonly sources: readonly RouteSource[];
}

/**
 * Pure tree-loading entry point. Resolves the supplied source list and builds
 * the parent/child tree in one step so wrappers can stay thin.
 *
 * @param args - the in-memory sources to process
 * @returns the constructed route tree with extraction issues attached
 */
export function loadRouteTree(args: LoadRouteTreeArgs): RouteTree {
  const resolved = resolveRouteSources(args.sources);
  const tree = buildRouteTree(resolved.nodes, resolved.issues);
  const result: RouteTree = {
    roots: tree.roots,
    byName: tree.byName,
    issues: tree.issues,
    filesChecked: resolved.filesChecked,
    nodeCount: tree.nodeCount
  };
  return result;
}

export { buildRouteTree } from './build-tree.js';
export { extractFile } from './extract.js';
export { formatRouteTree } from './format.js';
export type { RouteTreeFormat } from './format.js';
export { resolveRouteSources } from './resolve.js';
export type { RouteIssue, RouteIssueCode, RouteIssueSeverity, RouteNode, RouteSource, RouteTree, RouteTreeNode } from './types.js';
