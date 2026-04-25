/**
 * Filesystem inspection for `dbx_storagefile_model_validate_app`.
 *
 * Walks the component's `src/lib/model/storagefile/` recursively and
 * the API's `src/app/common/model/storagefile/` AND
 * `src/app/common/model/notification/` recursively (the second API
 * path is required because the storage-file processing handler is
 * itself a notification-task handler and may live under
 * `notification/handlers/...`). Every non-spec `.ts` file is read
 * into an {@link AppStorageFilesInspection}. Pure rules consume the
 * inspection result — specs build inspections directly without
 * touching the disk.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { AppStorageFilesInspection, InspectedFile, SideInspection, SideStatus } from './types.js';

const COMPONENT_STORAGEFILE_SUBPATH = 'src/lib/model/storagefile';
/**
 * The API storagefile module lives under `src/app/common/model/storagefile/`,
 * but the storage-file *processing* handler is wired through the
 * notification task service — so its config may live under
 * `src/app/common/model/notification/` (e.g.
 * `notification/handlers/storagefile/task.handler.storagefile.<purpose>.ts`).
 * Scan both subpaths.
 */
const API_STORAGEFILE_SUBPATHS: readonly string[] = ['src/app/common/model/storagefile', 'src/app/common/model/notification'];

export async function inspectAppStorageFiles(componentDir: string, apiDir: string): Promise<AppStorageFilesInspection> {
  const component = await inspectSide(componentDir, [COMPONENT_STORAGEFILE_SUBPATH]);
  const api = await inspectSide(apiDir, API_STORAGEFILE_SUBPATHS);
  const result: AppStorageFilesInspection = { component, api };
  return result;
}

async function inspectSide(rootDir: string, storagefileSubpaths: readonly string[]): Promise<SideInspection> {
  let status: SideStatus;
  let files: readonly InspectedFile[] = [];
  try {
    const stats = await stat(rootDir);
    if (!stats.isDirectory()) {
      status = 'dir-not-found';
      const result: SideInspection = { rootDir, storagefileFolder: undefined, status, files };
      return result;
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      status = 'dir-not-found';
      const result: SideInspection = { rootDir, storagefileFolder: undefined, status, files };
      return result;
    }
    throw err;
  }

  const presentFolders: string[] = [];
  const collectedFiles: InspectedFile[] = [];
  for (const sub of storagefileSubpaths) {
    const absFolder = join(rootDir, sub);
    try {
      const folderStats = await stat(absFolder);
      if (!folderStats.isDirectory()) continue;
    } catch {
      continue;
    }
    presentFolders.push(sub);
    const collected = await collectTsFiles(absFolder, rootDir);
    collectedFiles.push(...collected);
  }

  if (presentFolders.length === 0) {
    status = 'storagefile-folder-missing';
    const result: SideInspection = { rootDir, storagefileFolder: undefined, status, files };
    return result;
  }

  status = 'ok';
  files = collectedFiles;
  const result: SideInspection = { rootDir, storagefileFolder: presentFolders.join(','), status, files };
  return result;
}

async function collectTsFiles(absFolder: string, rootDir: string): Promise<readonly InspectedFile[]> {
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
