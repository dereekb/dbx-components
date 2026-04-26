/**
 * Filesystem inspection for `dbx_notification_m_validate_folder`.
 *
 * Stats the supplied component and API directories, locates the
 * notification area on each side, and reads the root `.ts` file list,
 * direct subdirectory names, and `index.ts` content (when present)
 * into a {@link NotificationFolderInspection}. Pure rules consume the
 * result — specs build inspections directly without touching the disk.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { API_NOTIFICATION_SUBPATH, COMPONENT_NOTIFICATION_SUBPATH, INDEX_FILE, type NotificationFolderInspection, type SideInspection, type SideStatus } from './types.js';

export interface InspectNotificationFolderInput {
  readonly componentRootDir: string;
  readonly componentRelDir: string;
  readonly apiRootDir: string;
  readonly apiRelDir: string;
}

/**
 * Reads the component and api notification folders off disk and returns the
 * snapshot the validator consumes. Centralises file-system access so the rule
 * layer stays pure.
 *
 * @param input - the component/api roots and relative paths to inspect
 * @returns the prepared inspection containing both sides' files
 */
export async function inspectNotificationFolder(input: InspectNotificationFolderInput): Promise<NotificationFolderInspection> {
  const component = await inspectSide({ side: 'component', rootDir: input.componentRootDir, relDir: input.componentRelDir, subPath: COMPONENT_NOTIFICATION_SUBPATH });
  const api = await inspectSide({ side: 'api', rootDir: input.apiRootDir, relDir: input.apiRelDir, subPath: API_NOTIFICATION_SUBPATH });
  const result: NotificationFolderInspection = {
    componentDir: input.componentRelDir,
    apiDir: input.apiRelDir,
    component,
    api
  };
  return result;
}

interface InspectSideInput {
  readonly side: 'component' | 'api';
  readonly rootDir: string;
  readonly relDir: string;
  readonly subPath: string;
}

async function inspectSide(input: InspectSideInput): Promise<SideInspection> {
  const { side, rootDir, relDir, subPath } = input;
  let status: SideStatus = 'ok';
  let files: readonly string[] = [];
  let entries: readonly string[] = [];
  let indexSource: string | undefined;

  const rootStatOk = await isExistingDirectory(rootDir);
  if (!rootStatOk) {
    status = 'dir-not-found';
  } else {
    const absFolder = join(rootDir, subPath);
    const folderStatOk = await isExistingDirectory(absFolder);
    if (!folderStatOk) {
      status = 'folder-missing';
    } else {
      const folder = await readNotificationFolder(absFolder);
      files = folder.files;
      entries = folder.entries;
      indexSource = folder.indexSource;
    }
  }

  const result: SideInspection = {
    side,
    rootDir: relDir,
    subPath,
    status,
    files,
    entries,
    indexSource
  };
  return result;
}

/**
 * Returns whether the path resolves to a directory, swallowing only the
 * benign `ENOENT`/`ENOTDIR` errors and rethrowing anything else.
 *
 * @param path - the absolute path to stat
 * @returns `true` when the path is an existing directory
 */
async function isExistingDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      throw err;
    }
    return false;
  }
}

interface ReadFolderResult {
  readonly files: readonly string[];
  readonly entries: readonly string[];
  readonly indexSource: string | undefined;
}

/**
 * Reads a notification folder's `.ts` files, direct subdirectory names, and
 * `index.ts` source (when present).
 *
 * @param absFolder - the absolute path to the notification folder
 * @returns the collected files, entries, and optional `index.ts` content
 */
async function readNotificationFolder(absFolder: string): Promise<ReadFolderResult> {
  const direntList = await readdir(absFolder, { withFileTypes: true });
  const collectedFiles: string[] = [];
  const collectedEntries: string[] = [];
  for (const entry of direntList) {
    if (entry.isDirectory()) {
      collectedEntries.push(entry.name);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts')) continue;
    collectedFiles.push(entry.name);
  }
  let indexSource: string | undefined;
  if (collectedFiles.includes(INDEX_FILE)) {
    try {
      indexSource = await readFile(join(absFolder, INDEX_FILE), 'utf8');
    } catch {
      indexSource = undefined;
    }
  }
  return { files: collectedFiles, entries: collectedEntries, indexSource };
}
