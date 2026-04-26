/**
 * Filesystem inspection for `dbx_notification_m_validate_app`.
 *
 * Walks each side's notification folder recursively and reads every
 * non-spec `.ts` file into an {@link AppNotificationsInspection}. Pure
 * rules consume the inspection result — specs build inspections
 * directly without touching the disk.
 */

import { inspectSide } from '../_validate/inspect.js';
import type { AppNotificationsInspection } from './types.js';

const COMPONENT_NOTIFICATION_SUBPATH = 'src/lib/model/notification';
/**
 * API-side notification logic lives primarily under
 * `src/app/common/model/notification/`, but the top-level
 * `appNotificationTemplateTypeInfoRecordService(...)` wiring is wired
 * from the sibling `src/app/common/firebase/` module (see
 * `apps/demo-api/src/app/common/firebase/action.module.ts`). Scan both.
 */
const API_NOTIFICATION_SUBPATHS: readonly string[] = ['src/app/common/model/notification', 'src/app/common/firebase'];

/**
 * Reads the component and api notification trees off disk and returns the
 * snapshot the validator/lister consume. Centralising the I/O here keeps the
 * pure layers free of file-system concerns.
 *
 * @param componentDir - absolute path to the component package root
 * @param apiDir - absolute path to the api package root
 * @returns the prepared inspection containing both sides' files
 */
export async function inspectAppNotifications(componentDir: string, apiDir: string): Promise<AppNotificationsInspection> {
  const component = await inspectSide(componentDir, [COMPONENT_NOTIFICATION_SUBPATH]);
  const api = await inspectSide(apiDir, API_NOTIFICATION_SUBPATHS);
  const result: AppNotificationsInspection = { component, api };
  return result;
}
