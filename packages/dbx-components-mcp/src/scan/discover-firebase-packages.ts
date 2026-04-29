/**
 * Discovery for downstream `-firebase` component packages.
 *
 * `dbx_model_search` and `dbx_model_lookup` extend their reach beyond the
 * upstream `@dereekb/firebase` registry by globbing the caller's workspace
 * for `components/<name>-firebase` packages on first use, then handing each
 * match's `src/lib/model/` directory to the runtime ts-morph extractor.
 *
 * The result is intentionally narrow: just the package name plus the model
 * root that the extractor needs. Errors during package-json reads degrade
 * to the directory basename so a malformed package never breaks discovery.
 */

import { glob as fsGlob, readFile, stat } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';

const COMPONENTS_GLOB = 'components/*-firebase';
const MODEL_SUBPATH = 'src/lib/model';
const PACKAGE_JSON = 'package.json';

/**
 * One downstream `-firebase` component package discovered under the caller's
 * workspace root. Both paths are workspace-relative and use forward slashes
 * regardless of platform — the extractor and the formatter render them as-is.
 */
export interface DownstreamFirebasePackage {
  /**
   * Canonical package name from `package.json` (e.g. `'demo-firebase'`).
   * Falls back to the directory basename when no `package.json` exists or
   * the file is unreadable.
   */
  readonly packageName: string;
  /**
   * Workspace-relative path to the component package root
   * (e.g. `'components/demo-firebase'`).
   */
  readonly componentDir: string;
  /**
   * Workspace-relative path to the model root, i.e.
   * `<componentDir>/src/lib/model` (forward-slash form).
   */
  readonly modelDir: string;
}

/**
 * Globs `components/*-firebase/` under `workspaceRoot` and returns every
 * directory whose `src/lib/model/` exists.
 *
 * Other layouts (`apps/*-firebase`, `libs/*-firebase`, `packages/*-firebase`)
 * are deliberately not scanned — `dbx_model_search` / `dbx_model_lookup`
 * accept an explicit `componentDirs` override for non-standard layouts.
 *
 * @param workspaceRoot - absolute path to the caller's workspace root
 * @returns the discovered packages sorted by `packageName`
 */
export async function discoverDownstreamFirebasePackages(workspaceRoot: string): Promise<readonly DownstreamFirebasePackage[]> {
  const out: DownstreamFirebasePackage[] = [];
  const seen = new Set<string>();
  for await (const match of fsGlob(COMPONENTS_GLOB, { cwd: workspaceRoot })) {
    const componentDir = match.split(sep).join('/');
    if (seen.has(componentDir)) continue;
    seen.add(componentDir);
    const componentAbs = resolve(workspaceRoot, componentDir);
    const pkg = await inspectPackage(componentAbs, componentDir);
    if (pkg) out.push(pkg);
  }
  out.sort((a, b) => a.packageName.localeCompare(b.packageName));
  return out;
}

/**
 * Resolves an explicit `componentDirs` override against the workspace root.
 * Each entry is checked for a `src/lib/model/` directory; entries that
 * don't have one are dropped. Mirrors the post-glob filtering in
 * {@link discoverDownstreamFirebasePackages}.
 *
 * @param workspaceRoot - absolute path to the caller's workspace root
 * @param componentDirs - workspace-relative directories to inspect
 * @returns the resolved packages (may be shorter than `componentDirs`)
 */
export async function resolveExplicitFirebasePackages(workspaceRoot: string, componentDirs: readonly string[]): Promise<readonly DownstreamFirebasePackage[]> {
  const out: DownstreamFirebasePackage[] = [];
  const seen = new Set<string>();
  for (const raw of componentDirs) {
    const componentDir = raw.split(sep).join('/').replace(/\/+$/, '');
    if (seen.has(componentDir) || componentDir.length === 0) continue;
    seen.add(componentDir);
    const componentAbs = resolve(workspaceRoot, componentDir);
    const pkg = await inspectPackage(componentAbs, componentDir);
    if (pkg) out.push(pkg);
  }
  out.sort((a, b) => a.packageName.localeCompare(b.packageName));
  return out;
}

async function inspectPackage(componentAbs: string, componentDir: string): Promise<DownstreamFirebasePackage | undefined> {
  const modelAbs = join(componentAbs, MODEL_SUBPATH);
  let isDir = false;
  try {
    const stats = await stat(modelAbs);
    isDir = stats.isDirectory();
  } catch {
    isDir = false;
  }
  let result: DownstreamFirebasePackage | undefined;
  if (isDir) {
    const packageName = await readPackageName(componentAbs, componentDir);
    result = {
      packageName,
      componentDir,
      modelDir: `${componentDir}/${MODEL_SUBPATH}`
    };
  }
  return result;
}

async function readPackageName(componentAbs: string, componentDir: string): Promise<string> {
  const fallback = basename(componentDir);
  let result = fallback;
  try {
    const text = await readFile(join(componentAbs, PACKAGE_JSON), 'utf8');
    const parsed = JSON.parse(text) as { readonly name?: unknown };
    if (typeof parsed.name === 'string' && parsed.name.length > 0) {
      result = parsed.name;
    }
  } catch {
    // Missing or malformed package.json — fall back to the directory basename.
  }
  return result;
}
