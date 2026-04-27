/**
 * Filesystem-walk shared by the two-side validate-app inspectors
 * (`storagefile-m-validate-app/inspect.ts`,
 * `notification-m-validate-app/inspect.ts`).
 *
 * Each domain configures the subpaths it wants checked under each side
 * and consumes the resulting {@link SideInspection} / collected
 * {@link InspectedFile}s — no domain-specific logic lives here.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { InspectedFile, SideInspection, SideStatus } from './inspection.types.js';

/**
 * Walks {@link rootDir} and returns the inspection record. Each
 * subpath in {@link subpaths} is checked relative to {@link rootDir};
 * present subpaths are walked recursively for non-spec `.ts` files,
 * and the joined list of present subpaths becomes the
 * {@link SideInspection.folder} field. The returned status is:
 *
 * - `'dir-not-found'` — root does not exist or is not a directory.
 * - `'folder-missing'` — root exists but none of {@link subpaths} did.
 * - `'ok'` — root exists and at least one subpath was present.
 *
 * @param rootDir - absolute path to the side's package root
 * @param subpaths - relative paths to consider under {@link rootDir}
 * @returns the prepared inspection
 */
export async function inspectSide(rootDir: string, subpaths: readonly string[]): Promise<SideInspection> {
  const rootStatus = await readRootStatus(rootDir);
  if (rootStatus !== undefined) {
    const result: SideInspection = { rootDir, folder: undefined, status: rootStatus, files: [] };
    return result;
  }

  const presentFolders: string[] = [];
  const collectedFiles: InspectedFile[] = [];
  for (const sub of subpaths) {
    const absFolder = join(rootDir, sub);
    const folderPresent = await isDirectory(absFolder);
    if (!folderPresent) continue;
    presentFolders.push(sub);
    const collected = await collectTsFiles(absFolder, rootDir);
    collectedFiles.push(...collected);
  }

  if (presentFolders.length === 0) {
    const result: SideInspection = { rootDir, folder: undefined, status: 'folder-missing', files: [] };
    return result;
  }

  const result: SideInspection = { rootDir, folder: presentFolders.join(','), status: 'ok', files: collectedFiles };
  return result;
}

/**
 * Returns `'dir-not-found'` when the root directory is missing or not
 * a directory, otherwise `undefined` to signal the walk should
 * continue. `ENOENT` / `ENOTDIR` errors are treated as "not found";
 * other errors propagate.
 *
 * @param rootDir - absolute path to the side's package root
 * @returns the short-circuit status, or `undefined`
 */
async function readRootStatus(rootDir: string): Promise<SideStatus | undefined> {
  try {
    const stats = await stat(rootDir);
    return stats.isDirectory() ? undefined : 'dir-not-found';
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return 'dir-not-found';
    }
    throw err;
  }
}

/**
 * Returns whether {@link absPath} resolves to an existing directory,
 * swallowing any stat error so the caller can fall through to the next
 * subpath without throwing.
 *
 * @param absPath - absolute path to check
 * @returns `true` when the path is a directory
 */
async function isDirectory(absPath: string): Promise<boolean> {
  try {
    const stats = await stat(absPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Walks {@link absFolder} recursively and reads every non-spec `.ts`
 * file into an {@link InspectedFile}. Paths are returned relative to
 * {@link rootDir} (POSIX-style, sep-normalised) and sorted by relPath
 * so the inspection is deterministic across platforms.
 *
 * @param absFolder - absolute path to walk
 * @param rootDir - absolute path used to compute the relPath
 * @returns the collected inspected files
 */
export async function collectTsFiles(absFolder: string, rootDir: string): Promise<readonly InspectedFile[]> {
  const out: InspectedFile[] = [];
  const stack: string[] = [absFolder];
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
      if (!entry.name.endsWith('.ts')) continue;
      if (entry.name.endsWith('.spec.ts')) continue;
      if (entry.name.endsWith('.d.ts')) continue;
      const text = await readFile(full, 'utf8');
      const rel = relative(rootDir, full).split(sep).join('/');
      out.push({ relPath: rel, text });
    }
  }
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}
