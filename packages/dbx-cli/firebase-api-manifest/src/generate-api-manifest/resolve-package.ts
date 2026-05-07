/**
 * Resolves a workspace module specifier (e.g. "@dereekb/firebase",
 * "demo-firebase", "./model", "./development") to a source-package root and
 * canonical import name.
 *
 * Reads the workspace tsconfig.base.json `compilerOptions.paths` to map bare
 * specifiers to their `src/index.ts` entry. Relative specifiers are resolved
 * against the importing file's directory and then walked back up to the
 * nearest `package.json` that owns them.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { PackageRef } from './types';

/** Inputs accepted by {@link resolveModuleToPackage}. */
export interface ResolveModuleInput {
  readonly workspaceRoot: string;
  readonly importingFile: string;
  readonly moduleSpecifier: string;
}

let _pathsCache: Map<string, string> | undefined;

/**
 * Reads `tsconfig.base.json` and returns the `compilerOptions.paths` map
 * (canonical bare specifier → absolute path to its `src/index.ts`).
 *
 * @param workspaceRoot - Workspace root directory.
 * @returns Cached map of canonical specifiers to absolute index paths.
 */
export function loadTsconfigPaths(workspaceRoot: string): Map<string, string> {
  if (_pathsCache) return _pathsCache;
  const tsconfigPath = join(workspaceRoot, 'tsconfig.base.json');
  const raw = readFileSync(tsconfigPath, 'utf8');
  const cleaned = stripJsonComments(raw);
  const tsconfig = JSON.parse(cleaned) as { compilerOptions?: { paths?: Record<string, readonly string[]> } };
  const paths = tsconfig.compilerOptions?.paths ?? {};
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(paths)) {
    if (Array.isArray(value) && value[0]) {
      map.set(key, resolve(workspaceRoot, value[0]));
    }
  }
  _pathsCache = map;
  return map;
}

/**
 * Resolves a module specifier to the source-package that owns it.
 *
 * @param input - Workspace root + importing-file location + the specifier.
 * @returns The {@link PackageRef} of the owning package, or `undefined` when unresolved.
 */
export function resolveModuleToPackage(input: ResolveModuleInput): PackageRef | undefined {
  const { workspaceRoot, importingFile, moduleSpecifier } = input;

  if (moduleSpecifier.startsWith('.')) {
    const importingDir = dirname(importingFile);
    const candidatePath = resolve(importingDir, moduleSpecifier);
    return locatePackageForPath(workspaceRoot, candidatePath);
  }

  const paths = loadTsconfigPaths(workspaceRoot);
  const indexFile = paths.get(moduleSpecifier);
  if (!indexFile) return undefined;
  return locatePackageForPath(workspaceRoot, indexFile);
}

/**
 * Walks up from `startPath` until it finds a directory containing a `package.json`
 * with a `name` field, then returns its package name + root.
 *
 * @param workspaceRoot - Stop walking when this directory is reached.
 * @param startPath - Path to walk up from.
 * @returns The package name + root, or `undefined` if no package.json is found.
 */
export function locatePackageForPath(workspaceRoot: string, startPath: string): PackageRef | undefined {
  let current = startPath;

  while (current && current !== workspaceRoot && current !== dirname(current)) {
    if (existsSync(join(current, 'package.json'))) {
      try {
        const pkg = JSON.parse(readFileSync(join(current, 'package.json'), 'utf8')) as { name?: string };
        if (pkg.name) return { packageName: pkg.name, packageRoot: current };
      } catch {
        // fall through and keep walking
      }
    }
    current = dirname(current);
  }

  return undefined;
}

/**
 * Returns the workspace-root-relative path with forward slashes for display.
 *
 * @param workspaceRoot - Workspace root directory.
 * @param absolutePath - Absolute path to make relative.
 * @returns The workspace-relative path with forward slashes.
 */
export function relPath(workspaceRoot: string, absolutePath: string): string {
  return relative(workspaceRoot, absolutePath).split('\\').join('/');
}

/**
 * Type-narrowed `isAbsolute` re-export so the generator scripts only depend on
 * `node:path` indirectly through this module.
 *
 * @param value - Path to test.
 * @returns `true` when the path is absolute.
 */
export function isAbsolutePathLike(value: string): boolean {
  return isAbsolute(value);
}

function stripJsonComments(text: string): string {
  return text.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/^\s*\/\/.*$/gm, '');
}
