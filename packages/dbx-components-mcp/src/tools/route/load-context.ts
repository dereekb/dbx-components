/**
 * Shared source-loading boilerplate for the `dbx_route_*` tool family.
 *
 * `dbx_route_lookup`, `dbx_route_search`, and `dbx_route_tree` all accept the
 * same `sources | paths | glob` triplet, run the same validate-then-load-then-
 * tree pipeline, and surface the same `toolError` messages. This helper folds
 * that pipeline into a single call so the per-tool handlers shrink to their
 * actual rendering logic.
 */

import { loadRouteSources } from './load-sources.js';
import { loadRouteTree } from './index.js';
import type { RouteSource, RouteTree } from './types.js';
import { toolError, type ToolResult } from '../types.js';

/**
 * Inputs accepted by every route tool — `sources` (in-memory snapshots),
 * `paths` (filesystem paths), and `glob` (filesystem glob). At least one
 * must be supplied; the tool errors out otherwise.
 */
export interface RouteContextInput {
  readonly sources: readonly RouteSource[] | undefined;
  readonly paths: readonly string[] | undefined;
  readonly glob: string | undefined;
  readonly cwd: string | undefined;
}

/**
 * Successful pipeline outcome — the resolved sources and the tree built
 * from them.
 */
export interface RouteContextSuccess {
  readonly kind: 'ok';
  readonly tree: RouteTree;
  readonly sources: readonly RouteSource[];
}

/**
 * Pipeline failure — a fully-formed {@link ToolResult} the handler should
 * return verbatim. All recognized failure modes (no input, load error, no
 * matches) come back as `kind: 'error'` so callers don't need their own
 * try/catch around the pipeline.
 */
export interface RouteContextFailure {
  readonly kind: 'error';
  readonly result: ToolResult;
}

/**
 * Discriminated union returned by {@link loadRouteContext}. Callers branch
 * once on `kind`; the `'ok'` branch surfaces `tree`/`sources` and the
 * `'error'` branch carries a ready-to-return {@link ToolResult}.
 */
export type RouteContextResult = RouteContextSuccess | RouteContextFailure;

/**
 * Validates the input triplet, loads the sources, and builds the route
 * tree. Returns the tree on success, or a ready-to-return {@link ToolResult}
 * for any of the three known failure modes (empty input, source-load throw,
 * zero matched files).
 *
 * @param input - the `sources` / `paths` / `glob` / `cwd` quad from a tool's
 *   parsed args
 * @returns either the loaded `tree` + `sources`, or an error `ToolResult`
 */
export async function loadRouteContext(input: RouteContextInput): Promise<RouteContextResult> {
  const hasAny = (input.sources && input.sources.length > 0) || (input.paths && input.paths.length > 0) || input.glob;
  if (!hasAny) {
    return { kind: 'error', result: toolError('Must provide at least one of `sources`, `paths`, or `glob`.') };
  }

  let sources: readonly RouteSource[];
  try {
    const loaded = await loadRouteSources({
      sources: input.sources,
      paths: input.paths,
      glob: input.glob,
      cwd: input.cwd,
      walkImports: true
    });
    sources = loaded.sources;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: 'error', result: toolError(`Failed to read sources: ${message}`) };
  }

  if (sources.length === 0) {
    return { kind: 'error', result: toolError('No matching source files found.') };
  }

  const tree = loadRouteTree({ sources });
  return { kind: 'ok', tree, sources };
}
