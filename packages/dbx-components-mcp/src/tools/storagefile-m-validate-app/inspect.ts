/**
 * Filesystem inspection for `dbx_storagefile_m_validate_app`.
 *
 * Walks the component's `src/lib/model/storagefile/` recursively and
 * the API's `src/app/common/model/storagefile/` AND
 * `src/app/common/model/notification/` recursively (the second API
 * path is required because the storage-file processing handler is
 * itself a notification-task handler and may live under
 * `notification/handlers/...`). Pure rules consume the
 * {@link AppStorageFilesInspection} result — specs build inspections
 * directly without touching the disk.
 */

import { inspectSide } from '../_validate/inspect.js';
import type { AppStorageFilesInspection } from './types.js';

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

/**
 * Reads the component and api storage-file trees off disk and returns the
 * snapshot the validator/lister consume. Centralising the I/O here keeps the
 * pure layers free of file-system concerns.
 *
 * @param componentDir - absolute path to the component package root
 * @param apiDir - absolute path to the api package root
 * @returns the prepared inspection containing both sides' files
 */
export async function inspectAppStorageFiles(componentDir: string, apiDir: string): Promise<AppStorageFilesInspection> {
  const component = await inspectSide(componentDir, [COMPONENT_STORAGEFILE_SUBPATH]);
  const api = await inspectSide(apiDir, API_STORAGEFILE_SUBPATHS);
  const result: AppStorageFilesInspection = { component, api };
  return result;
}
