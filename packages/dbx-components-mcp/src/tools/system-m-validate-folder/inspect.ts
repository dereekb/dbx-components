/**
 * Filesystem inspection for `dbx_system_m_validate_folder`.
 *
 * Resolves a folder path, stats it, lists its direct `.ts` children, and
 * reads `system.ts` when present into a {@link SystemFolderInspection}.
 * Pure rules consume the inspection result — specs build inspections
 * directly without touching the disk.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { FolderInspectionStatus, SystemFolderInspection } from './types.js';

export async function inspectFolder(path: string): Promise<SystemFolderInspection> {
  const name = basename(path);
  let status: FolderInspectionStatus;
  let files: readonly string[] = [];
  let systemSource: string | undefined;
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
      if (collected.includes('system.ts')) {
        try {
          systemSource = await readFile(join(path, 'system.ts'), 'utf8');
        } catch {
          systemSource = undefined;
        }
      }
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      status = 'not-found';
    } else {
      throw err;
    }
  }
  const result: SystemFolderInspection = { name, path, status, files, systemSource };
  return result;
}
