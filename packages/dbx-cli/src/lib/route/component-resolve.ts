/**
 * Pure component-source resolution: given a router file's text and a rendered
 * component class name, find the source file that declares the component among
 * an already-loaded set of {@link RouteSource} records.
 *
 * Unlike the dev-server tool's fs-backed resolver, this works entirely against
 * the in-memory source set the route-manifest builder already gathered, so it
 * performs no disk I/O. Path arithmetic uses POSIX semantics because source
 * names are workspace-relative, slash-delimited paths.
 */

import { dirname, join, normalize } from 'node:path/posix';
import type { RouteSource } from './route-types.js';

/**
 * Resolved component source location. `path` is the matched source name when
 * the import resolved inside the source set, or the raw module specifier when
 * it could not be resolved (e.g. a node-module / barrel import).
 */
export interface ComponentSourceResult {
  readonly path: string;
  readonly moduleSpecifier: string;
}

/**
 * Input to {@link resolveComponentSourceFromSources}.
 */
export interface ResolveComponentSourceInput {
  /**
   * Source name of the file that declares the state (and imports the component).
   */
  readonly routerFile: string;
  /**
   * Component class name rendered by the state.
   */
  readonly component: string;
  /**
   * The full in-memory source set the manifest builder gathered.
   */
  readonly sources: readonly RouteSource[];
}

const TRY_EXTENSIONS: readonly string[] = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

/**
 * Resolves the source file that declares `component`, traced from its import in
 * the router file. Returns `undefined` when the router file isn't in the set or
 * the component isn't imported there; returns the raw specifier as `path` when
 * the import is non-relative (node module / path alias) or can't be matched to
 * a loaded source.
 *
 * @param input - The router file name, component class, and source set.
 * @returns The resolved component source location, or `undefined`.
 */
export function resolveComponentSourceFromSources(input: ResolveComponentSourceInput): ComponentSourceResult | undefined {
  const byName = new Map<string, RouteSource>();
  for (const source of input.sources) {
    byName.set(source.name, source);
  }

  const routerSource = byName.get(input.routerFile);
  let result: ComponentSourceResult | undefined;

  if (routerSource !== undefined) {
    const specifier = findImportSpecifier(routerSource.text, input.component);
    if (specifier !== undefined) {
      result = resolveSpecifier(specifier, input.routerFile, byName);
    }
  }

  return result;
}

function resolveSpecifier(specifier: string, routerFile: string, byName: ReadonlyMap<string, RouteSource>): ComponentSourceResult {
  let result: ComponentSourceResult;
  if (specifier.startsWith('.')) {
    const base = normalize(join(dirname(routerFile), specifier));
    let resolved: string | undefined;
    for (const ext of TRY_EXTENSIONS) {
      const candidate = base + ext;
      if (byName.has(candidate)) {
        resolved = candidate;
        break;
      }
    }
    result = { path: resolved ?? specifier, moduleSpecifier: specifier };
  } else {
    result = { path: specifier, moduleSpecifier: specifier };
  }
  return result;
}

function findImportSpecifier(text: string, component: string): string | undefined {
  const importRegex = /import\s+[^'"]+from\s+['"]([^'"]+)['"]/gu;
  let result: string | undefined;
  let match = importRegex.exec(text);
  while (match !== null) {
    if (containsImportedSymbol(match[0], component)) {
      result = match[1];
      break;
    }
    match = importRegex.exec(text);
  }
  return result;
}

function containsImportedSymbol(importStatement: string, symbol: string): boolean {
  const braceStart = importStatement.indexOf('{');
  const braceEnd = importStatement.indexOf('}');
  let result = false;
  if (braceStart >= 0 && braceEnd > braceStart) {
    const inside = importStatement.slice(braceStart + 1, braceEnd);
    for (const raw of inside.split(',')) {
      const cleaned = raw.replace(/\s+as\s+\w+/u, '').trim();
      if (cleaned === symbol) {
        result = true;
        break;
      }
    }
  }
  if (!result) {
    const defaultRegex = new RegExp(String.raw`^import\s+(?:type\s+)?(${symbol})\s+from\s+`, 'u');
    result = defaultRegex.test(importStatement);
  }
  return result;
}
