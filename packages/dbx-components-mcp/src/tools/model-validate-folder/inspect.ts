/**
 * Filesystem inspection for `dbx_validate_model_folder`.
 *
 * Resolves a folder path, stats it, and reads its direct `.ts` children
 * into a {@link FolderInspection}. Pure rules consume the inspection
 * result — specs build inspections directly without touching the disk.
 */

import { readdir, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import type { FolderInspection, FolderInspectionStatus } from './types.js';

/**
 * Stats a folder and lists its direct `.ts` children, capturing enough
 * filesystem state for the pure rules to validate against. Specs construct
 * inspections directly without using this function.
 *
 * @param path - absolute path to the folder to inspect
 * @returns the inspection record describing the folder's status and contents
 */
export async function inspectFolder(path: string): Promise<FolderInspection> {
  const name = basename(path);
  let status: FolderInspectionStatus;
  let files: readonly string[] = [];
  try {
    const stats = await stat(path);
    if (!stats.isDirectory()) {
      status = 'not-directory';
    } else {
      status = 'ok';
      const entries = await readdir(path, { withFileTypes: true });
      const collected: string[] = [];
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith('.ts')) continue;
        collected.push(entry.name);
      }
      files = collected;
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      status = 'not-found';
    } else {
      throw err;
    }
  }
  const result: FolderInspection = { name, path, status, files };
  return result;
}
