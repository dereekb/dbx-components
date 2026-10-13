/**
 * Filesystem inspection for `dbx_notification_m_validate_app`.
 *
 * Walks each side's notification folders recursively and reads every
 * non-spec `.ts` file into an {@link AppNotificationsInspection}. Pure
 * rules consume the inspection result — specs build inspections
 * directly without touching the disk.
 *
 * Scanned folders:
 * - component: `src/lib/model/notification/`
 * - api: `src/app/common/model/notification/`, `src/app/common/firebase/` and `src/app/function/notification/`
 *
 * When the caller passes them, the workspace's `firestore.rules` and
 * `firestore.indexes.json` are read too, for the NotificationTaskBot
 * `ntb` rule and `ntb.nat` index checks.
 */

import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { inspectSide } from '../_core/_validate/inspect.js';
import type { AppNotificationsInspection, AppNotificationsWorkspaceFiles, InspectedWorkspaceFile } from './types.js';

const COMPONENT_NOTIFICATION_SUBPATH = 'src/lib/model/notification';
/**
 * API-side notification logic lives primarily under
 * `src/app/common/model/notification/`, but the top-level
 * `appNotificationTemplateTypeInfoRecordService(...)` wiring is wired
 * from the sibling `src/app/common/firebase/` module (see
 * `apps/demo-api/src/app/common/firebase/action.module.ts`), and the
 * notification schedule (which runs the NotificationTaskBot repair sweep)
 * lives in `src/app/function/notification/`. Scan all three.
 */
const API_NOTIFICATION_SUBPATHS: readonly string[] = ['src/app/common/model/notification', 'src/app/common/firebase', 'src/app/function/notification'];

/**
 * Optional workspace files read for the NotificationTaskBot checks.
 */
export interface InspectAppNotificationsOptions {
  /**
   * Absolute path to the workspace's `firestore.rules`. When set, it is read for the NotificationTaskBot `ntb` rule check; when unset, that check is skipped.
   */
  readonly firestoreRulesPath?: string;
  /**
   * Absolute path to the workspace's `firestore.indexes.json`, read for the `ntb.nat` index check. When unset, that check is skipped.
   */
  readonly firestoreIndexesPath?: string;
  /**
   * Absolute workspace root, used to show the two paths above as workspace-relative paths in findings. Defaults to `process.cwd()`.
   */
  readonly workspaceDir?: string;
}

/**
 * Reads the component and api notification trees off disk and returns the
 * snapshot the validator/lister consume. Centralising the I/O here keeps the
 * pure layers free of file-system concerns.
 *
 * @param componentDir - Absolute path to the component package root.
 * @param apiDir - Absolute path to the api package root.
 * @param options - Optional workspace files for the NotificationTaskBot checks.
 * @returns The prepared inspection containing both sides' files.
 */
export async function inspectAppNotifications(componentDir: string, apiDir: string, options?: InspectAppNotificationsOptions): Promise<AppNotificationsInspection> {
  const component = await inspectSide(componentDir, [COMPONENT_NOTIFICATION_SUBPATH]);
  const api = await inspectSide(apiDir, API_NOTIFICATION_SUBPATHS);
  const workspace = await inspectWorkspaceFiles(options);
  const result: AppNotificationsInspection = workspace ? { component, api, workspace } : { component, api };
  return result;
}

async function inspectWorkspaceFiles(options: InspectAppNotificationsOptions | undefined): Promise<AppNotificationsWorkspaceFiles | undefined> {
  let result: AppNotificationsWorkspaceFiles | undefined;
  if (options?.firestoreRulesPath || options?.firestoreIndexesPath) {
    const workspaceDir = options.workspaceDir ?? process.cwd();
    result = {
      firestoreRules: options.firestoreRulesPath ? await readWorkspaceFile(options.firestoreRulesPath, workspaceDir) : undefined,
      firestoreIndexes: options.firestoreIndexesPath ? await readWorkspaceFile(options.firestoreIndexesPath, workspaceDir) : undefined
    };
  }
  return result;
}

async function readWorkspaceFile(absPath: string, workspaceDir: string): Promise<InspectedWorkspaceFile> {
  let text: string | undefined;
  try {
    text = await readFile(absPath, 'utf8');
  } catch {
    text = undefined;
  }
  const result: InspectedWorkspaceFile = { path: relative(workspaceDir, absPath) || absPath, text };
  return result;
}
