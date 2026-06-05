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

/**
 * Stats a system-state folder, reads its source listing, and pulls the main
 * `<name>.system.ts` text into memory so the rule layer can inspect it
 * without further I/O.
 *
 * @param path - Absolute path to the system folder to inspect.
 * @returns The inspection record describing the folder's status, files, and source text.
 */
export async function inspectFolder(path: string): Promise<SystemFolderInspection> {
  const name = basename(path);
  const probe = await probeFolderStatus(path);
  const status: FolderInspectionStatus = probe.status;
  let files: readonly string[] = [];
  let systemSource: string | undefined;
  if (probe.status === 'ok') {
    const listed = await listTypeScriptFiles(path);
    files = listed;
    if (listed.includes('system.ts')) {
      systemSource = await tryReadSystemSource(path);
    }
  }
  const result: SystemFolderInspection = { name, path, status, files, systemSource };
  return result;
}

async function probeFolderStatus(path: string): Promise<{ readonly status: FolderInspectionStatus }> {
  let status: FolderInspectionStatus;
  try {
    const stats = await stat(path);
    status = stats.isDirectory() ? 'ok' : 'not-directory';
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      throw err;
    }
    status = 'not-found';
  }
  return { status };
}

async function listTypeScriptFiles(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const collected: string[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      collected.push(entry.name);
    }
  }
  return collected;
}

async function tryReadSystemSource(path: string): Promise<string | undefined> {
  let result: string | undefined;
  try {
    result = await readFile(join(path, 'system.ts'), 'utf8');
  } catch {
    result = undefined;
  }
  return result;
}
