/**
 * Filesystem inspection for `dbx_asset_validate_app`.
 *
 * Walks the component's `src/lib/` (collecting only `assets.ts` and
 * `index.ts` — the two files the rules consult) and the Angular app's
 * `src/root.app.config.ts` plus `src/assets/` directory tree. Pure
 * rules consume the {@link AppAssetsInspection} result — specs build
 * inspections directly without touching the disk.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { InspectedFile, SideInspection } from '../_validate/inspection.types.js';
import type { AppAssetWiringInspection, AppAssetsInspection } from './types.js';

const COMPONENT_LIB_SUBPATH = 'src/lib';
const APP_ROOT_CONFIG_RELPATH = 'src/root.app.config.ts';
const APP_ASSETS_SUBPATH = 'src/assets';

/**
 * Reads the component `src/lib/` files relevant to the asset rules
 * (`assets.ts` and `index.ts`) plus the Angular app's
 * `src/root.app.config.ts` and `src/assets/` listing.
 *
 * @param componentDir - absolute path to the component package root
 * @param appDir - absolute path to the Angular app root
 * @returns the prepared two-side inspection
 */
export async function inspectAppAssets(componentDir: string, appDir: string): Promise<AppAssetsInspection> {
  const component = await inspectComponentLib(componentDir);
  const appStatus = await readAppRootStatus(appDir);
  const app = appStatus === 'ok' ? await readAppWiring(appDir) : { rootConfigText: undefined, assetFiles: new Set<string>() };
  const result: AppAssetsInspection = {
    component,
    app,
    appRootDir: appDir,
    appStatus
  };
  return result;
}

async function inspectComponentLib(rootDir: string): Promise<SideInspection> {
  let rootStats;
  try {
    rootStats = await stat(rootDir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return { rootDir, folder: undefined, status: 'dir-not-found', files: [] };
    }
    throw err;
  }
  if (!rootStats.isDirectory()) {
    return { rootDir, folder: undefined, status: 'dir-not-found', files: [] };
  }

  const libDir = join(rootDir, COMPONENT_LIB_SUBPATH);
  const libExists = await isDirectory(libDir);
  if (!libExists) {
    return { rootDir, folder: undefined, status: 'folder-missing', files: [] };
  }

  const files: InspectedFile[] = [];
  for (const name of ['assets.ts', 'index.ts']) {
    const abs = join(libDir, name);
    const text = await readFileIfExists(abs);
    if (text !== undefined) {
      const rel = relative(rootDir, abs).split(sep).join('/');
      files.push({ relPath: rel, text });
    }
  }
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return { rootDir, folder: COMPONENT_LIB_SUBPATH, status: 'ok', files };
}

async function readAppRootStatus(appDir: string): Promise<'ok' | 'dir-not-found'> {
  try {
    const stats = await stat(appDir);
    return stats.isDirectory() ? 'ok' : 'dir-not-found';
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return 'dir-not-found';
    }
    throw err;
  }
}

async function readAppWiring(appDir: string): Promise<AppAssetWiringInspection> {
  const rootConfigText = await readFileIfExists(join(appDir, APP_ROOT_CONFIG_RELPATH));
  const assetsDir = join(appDir, APP_ASSETS_SUBPATH);
  const assetsDirExists = await isDirectory(assetsDir);
  const assetFiles = assetsDirExists ? await collectFilesUnder(assetsDir) : new Set<string>();
  const result: AppAssetWiringInspection = { rootConfigText, assetFiles };
  return result;
}

async function isDirectory(absPath: string): Promise<boolean> {
  try {
    const stats = await stat(absPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function readFileIfExists(absPath: string): Promise<string | undefined> {
  try {
    return await readFile(absPath, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EISDIR') {
      return undefined;
    }
    throw err;
  }
}

/**
 * Walks `absRoot` recursively and returns POSIX-relative paths (relative
 * to `absRoot`) of every file beneath it, regardless of extension. Used
 * to test whether a `localAsset(path)` reference has a matching file in
 * the Angular app's `src/assets/` tree.
 *
 * @param absRoot - absolute path to walk (e.g. `<appDir>/src/assets`)
 * @returns the set of POSIX-relative file paths
 */
async function collectFilesUnder(absRoot: string): Promise<ReadonlySet<string>> {
  const out = new Set<string>();
  const stack: string[] = [absRoot];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = relative(absRoot, full).split(sep).join('/');
      out.add(rel);
    }
  }
  return out;
}
