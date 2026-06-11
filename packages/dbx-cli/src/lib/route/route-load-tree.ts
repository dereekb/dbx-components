/**
 * Pure tree-loading entry point. The fs/glob I/O layer lives in the caller —
 * this module receives a list of {@link RouteSource} records and produces a
 * normalized {@link RouteTree}.
 */

import { buildRouteTree } from './route-build-tree.js';
import { resolveRouteSources } from './route-resolve-sources.js';
import type { RouteSource, RouteTree } from './route-types.js';

export interface LoadRouteTreeArgs {
  readonly sources: readonly RouteSource[];
}

/**
 * Pure tree-loading entry point. Resolves the supplied source list and builds
 * the parent/child tree in one step so callers can stay thin.
 *
 * @param args - The in-memory sources to process.
 * @returns The constructed route tree with extraction issues attached.
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
