/**
 * Pure entry point for the list tool. Callers pass a prepared
 * `AppStorageFilesInspection` and receive an {@link AppStorageFilesReport}.
 */

import { extractAppStorageFiles, type AppStorageFilesInspection } from '../storagefile-m-validate-app/index.js';
import { collectAppStorageFiles } from './collect.js';
import type { AppStorageFilesReport } from './types.js';

export interface ListAppStorageFilesOptions {
  readonly componentDir: string;
  readonly apiDir: string;
}

/**
 * Pure listing entry point. Reuses the validator's extraction step and
 * reshapes the output into the listing report so registration state and
 * validator findings stay in sync.
 *
 * @param inspection - the prepared filesystem inspection (component + api files)
 * @param options - workspace directories used to relativise emitted paths
 * @returns the listing report
 */
export function listAppStorageFiles(inspection: AppStorageFilesInspection, options: ListAppStorageFilesOptions): AppStorageFilesReport {
  const extracted = extractAppStorageFiles(inspection);
  return collectAppStorageFiles(extracted, options);
}

export { formatReportAsJson } from './format.json.js';
export { formatReportAsMarkdown } from './format.markdown.js';
export type { AppStorageFilesReport, StorageFilePurposeSummary } from './types.js';
