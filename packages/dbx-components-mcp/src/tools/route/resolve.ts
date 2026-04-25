/**
 * Helpers for transitive resolution across multiple route sources.
 *
 * Two flavors:
 *
 *   1. {@link resolveRouteSources} — walks every supplied source and emits a
 *      flat node list. Used when the caller already gathered a glob/path set.
 *   2. {@link computeReachableSpecifiers} — given a starting source, returns
 *      the relative import specifiers it depends on. The tool wrapper uses
 *      this to walk the file tree off-disk.
 *
 * The pure core never touches the file system — the tool wrapper does the
 * `readFile`-and-recurse loop, calling back into {@link extractFile} for each
 * file it loads.
 */

import { extractFile } from './extract.js';
import type { RouteIssue, RouteNode, RouteSource } from './types.js';

export interface ResolvedSources {
  readonly nodes: readonly RouteNode[];
  readonly issues: readonly RouteIssue[];
  readonly filesChecked: number;
}

export function resolveRouteSources(sources: readonly RouteSource[]): ResolvedSources {
  const nodes: RouteNode[] = [];
  const issues: RouteIssue[] = [];
  for (const source of sources) {
    const extracted = extractFile(source);
    for (const node of extracted.nodes) {
      nodes.push(node);
    }
    for (const issue of extracted.issues) {
      issues.push(issue);
    }
  }
  const result: ResolvedSources = {
    nodes,
    issues,
    filesChecked: sources.length
  };
  return result;
}

/**
 * Returns the relative module specifiers imported by `source` — used to plan
 * the next round of file reads in transitive walking. Specifiers are
 * left untouched (no `.ts` resolution); the caller normalizes them.
 */
export function computeRelativeSpecifiers(source: RouteSource): readonly string[] {
  const extracted = extractFile(source);
  const out: string[] = [];
  for (const imp of extracted.importedFromRelative) {
    out.push(imp.moduleSpecifier);
  }
  return out;
}
