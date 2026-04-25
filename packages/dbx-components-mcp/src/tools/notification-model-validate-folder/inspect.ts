/**
 * Filesystem inspection for `dbx_notification_model_validate_folder`.
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

  let rootStatOk = false;
  try {
    const rootStats = await stat(rootDir);
    rootStatOk = rootStats.isDirectory();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      throw err;
    }
  }
  if (!rootStatOk) {
    status = 'dir-not-found';
  } else {
    const absFolder = join(rootDir, subPath);
    let folderStatOk = false;
    try {
      const folderStats = await stat(absFolder);
      folderStatOk = folderStats.isDirectory();
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') {
        throw err;
      }
    }
    if (!folderStatOk) {
      status = 'folder-missing';
    } else {
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
      files = collectedFiles;
      entries = collectedEntries;
      if (collectedFiles.includes(INDEX_FILE)) {
        try {
          indexSource = await readFile(join(absFolder, INDEX_FILE), 'utf8');
        } catch {
          indexSource = undefined;
        }
      }
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
