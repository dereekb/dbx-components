/**
 * Filesystem inspection for `dbx_notification_m_validate_app`.
 *
 * Walks each side's notification folder recursively and reads every
 * non-spec `.ts` file into an {@link AppNotificationsInspection}. Pure
 * rules consume the inspection result — specs build inspections
 * directly without touching the disk.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { AppNotificationsInspection, InspectedFile, SideInspection, SideStatus } from './types.js';

const COMPONENT_NOTIFICATION_SUBPATH = 'src/lib/model/notification';
/**
 * API-side notification logic lives primarily under
 * `src/app/common/model/notification/`, but the top-level
 * `appNotificationTemplateTypeInfoRecordService(...)` wiring is wired
 * from the sibling `src/app/common/firebase/` module (see
 * `apps/demo-api/src/app/common/firebase/action.module.ts`). Scan both.
 */
const API_NOTIFICATION_SUBPATHS: readonly string[] = ['src/app/common/model/notification', 'src/app/common/firebase'];

export async function inspectAppNotifications(componentDir: string, apiDir: string): Promise<AppNotificationsInspection> {
  const component = await inspectSide(componentDir, [COMPONENT_NOTIFICATION_SUBPATH]);
  const api = await inspectSide(apiDir, API_NOTIFICATION_SUBPATHS);
  const result: AppNotificationsInspection = { component, api };
  return result;
}

async function inspectSide(rootDir: string, notificationSubpaths: readonly string[]): Promise<SideInspection> {
  let status: SideStatus;
  let files: readonly InspectedFile[] = [];
  try {
    const stats = await stat(rootDir);
    if (!stats.isDirectory()) {
      status = 'dir-not-found';
      const result: SideInspection = { rootDir, notificationFolder: undefined, status, files };
      return result;
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      status = 'dir-not-found';
      const result: SideInspection = { rootDir, notificationFolder: undefined, status, files };
      return result;
    }
    throw err;
  }

  const presentFolders: string[] = [];
  const collectedFiles: InspectedFile[] = [];
  for (const sub of notificationSubpaths) {
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
    status = 'notification-folder-missing';
    const result: SideInspection = { rootDir, notificationFolder: undefined, status, files };
    return result;
  }

  status = 'ok';
  files = collectedFiles;
  const result: SideInspection = { rootDir, notificationFolder: presentFolders.join(','), status, files };
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
