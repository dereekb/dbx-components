/**
 * Shared `paths` / `glob` / `sources` resolver used by all three route tools.
 *
 * Mirrors the model-validate pattern: every input form is funneled into a
 * single `RouteSource[]` that the pure core can consume. Path inputs are
 * resolved against the server cwd with a traversal guard.
 *
 * Transitive walking: starting from each `path`, we follow relative imports
 * (`./foo`, `../bar/baz`) recursively until no new files are discovered.
 * `.ts`, `.tsx`, `.module.ts`, `.router.ts` extensions are tried in order
 * (we stop at the first that exists). Imports without extensions are also
 * resolved against `<dir>/<name>/index.ts`.
 */

import { glob as fsGlob, readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { computeRelativeSpecifiers } from './resolve.js';
import type { RouteSource } from './types.js';

export interface LoadSourcesArgs {
  readonly sources: readonly RouteSource[] | undefined;
  readonly paths: readonly string[] | undefined;
  readonly glob: string | undefined;
  readonly cwd: string | undefined;
  /**
   * When true, `paths` are walked transitively via their relative imports.
   */
  readonly walkImports: boolean;
}

export interface LoadedSources {
  readonly sources: readonly RouteSource[];
  readonly cwdResolved: string;
}

const TRY_EXTENSIONS: readonly string[] = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

/**
 * Resolves a glob (or explicit file list) into the in-memory `RouteSource`
 * snapshots the route core consumes. Centralises path-traversal guarding and
 * extension fallback so the route tools share one filesystem layer.
 *
 * @param args - glob/file list, optional cwd, and source-resolution flags
 * @returns the materialised sources alongside the resolved cwd used
 */
export async function loadRouteSources(args: LoadSourcesArgs): Promise<LoadedSources> {
  const cwdResolved = args.cwd ? resolve(process.cwd(), args.cwd) : process.cwd();
  guardCwdInsideServer(args.cwd, cwdResolved);

  const collected = new Map<string, RouteSource>();
  if (args.sources) {
    for (const src of args.sources) {
      if (!collected.has(src.name)) {
        collected.set(src.name, src);
      }
    }
  }

  const initialPaths = await collectInitialPaths(args, cwdResolved);
  for (const relative of initialPaths) {
    await loadOne(relative, cwdResolved, collected);
  }

  if (args.walkImports) {
    await walkRelativeImports(collected, cwdResolved);
  }

  const result: LoadedSources = {
    sources: Array.from(collected.values()),
    cwdResolved
  };
  return result;
}

/**
 * Throws when an explicit cwd input resolves outside the server cwd, mirroring
 * the path-traversal guard the rest of the loader applies.
 *
 * @param requestedCwd - the original cwd argument from the caller
 * @param resolvedCwd - the resolved absolute path
 */
function guardCwdInsideServer(requestedCwd: string | undefined, resolvedCwd: string): void {
  if (!requestedCwd) {
    return;
  }
  const serverCwd = process.cwd();
  const cwdPrefix = serverCwd.endsWith(sep) ? serverCwd : serverCwd + sep;
  if (!resolvedCwd.startsWith(cwdPrefix) && resolvedCwd !== serverCwd) {
    throw new Error(`cwd \`${requestedCwd}\` resolves outside the server cwd and is not allowed.`);
  }
}

/**
 * Concatenates explicit `paths` with the matches of an optional `glob`, both
 * relative to the resolved cwd.
 *
 * @param args - the loader arguments providing `paths` and/or `glob`
 * @param cwdResolved - the resolved cwd used as glob base
 * @returns the combined relative path list to load directly
 */
async function collectInitialPaths(args: LoadSourcesArgs, cwdResolved: string): Promise<string[]> {
  const initialPaths: string[] = [];
  if (args.paths) {
    for (const p of args.paths) {
      initialPaths.push(p);
    }
  }
  if (args.glob) {
    for await (const match of fsGlob(args.glob, { cwd: cwdResolved })) {
      initialPaths.push(match);
    }
  }
  return initialPaths;
}

/**
 * Performs a BFS through relative imports starting from every source already
 * present in `collected`, adding newly resolved sources to the same map.
 *
 * @param collected - the source map to extend in place
 * @param cwdResolved - the resolved cwd used to build absolute paths
 */
async function walkRelativeImports(collected: Map<string, RouteSource>, cwdResolved: string): Promise<void> {
  const queue = Array.from(collected.values());
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) {
      break;
    }
    const specifiers = computeRelativeSpecifiers(next);
    for (const specifier of specifiers) {
      const resolved = await resolveRelativeImport(next.name, specifier, cwdResolved);
      if (!resolved) {
        continue;
      }
      if (collected.has(resolved.name)) {
        continue;
      }
      collected.set(resolved.name, resolved);
      queue.push(resolved);
    }
  }
}

async function loadOne(relative: string, cwd: string, into: Map<string, RouteSource>): Promise<void> {
  if (into.has(relative)) {
    return;
  }
  const absolute = resolve(cwd, relative);
  const cwdPrefix = cwd.endsWith(sep) ? cwd : cwd + sep;
  if (!absolute.startsWith(cwdPrefix) && absolute !== cwd) {
    throw new Error(`Path \`${relative}\` resolves outside the server cwd and is not allowed.`);
  }
  const text = await readFile(absolute, 'utf8');
  into.set(relative, { name: relative, text });
}

async function resolveRelativeImport(fromFile: string, specifier: string, cwd: string): Promise<RouteSource | undefined> {
  if (!specifier.startsWith('.')) {
    return undefined;
  }
  const fromAbsolute = isAbsolute(fromFile) ? fromFile : resolve(cwd, fromFile);
  const fromDir = dirname(fromAbsolute);
  const baseAbsolute = resolve(fromDir, specifier);
  const cwdPrefix = cwd.endsWith(sep) ? cwd : cwd + sep;
  for (const ext of TRY_EXTENSIONS) {
    const candidateAbsolute = baseAbsolute + ext;
    if (!candidateAbsolute.startsWith(cwdPrefix) && candidateAbsolute !== cwd) {
      continue;
    }
    const exists = await fileExists(candidateAbsolute);
    if (!exists) {
      continue;
    }
    const text = await readFile(candidateAbsolute, 'utf8');
    const relativeName = candidateAbsolute.startsWith(cwdPrefix) ? candidateAbsolute.slice(cwdPrefix.length) : candidateAbsolute;
    const result: RouteSource = { name: relativeName, text };
    return result;
  }
  return undefined;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}
