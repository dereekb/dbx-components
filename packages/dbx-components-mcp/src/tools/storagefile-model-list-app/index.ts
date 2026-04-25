/**
 * Pure entry point for the list tool. Callers pass a prepared
 * `AppStorageFilesInspection` and receive an {@link AppStorageFilesReport}.
 */

import { extractAppStorageFiles, type AppStorageFilesInspection } from '../storagefile-model-validate-app/index.js';
import { collectAppStorageFiles } from './collect.js';
import type { AppStorageFilesReport } from './types.js';

export interface ListAppStorageFilesOptions {
  readonly componentDir: string;
  readonly apiDir: string;
}

export function listAppStorageFiles(inspection: AppStorageFilesInspection, options: ListAppStorageFilesOptions): AppStorageFilesReport {
  const extracted = extractAppStorageFiles(inspection);
  const report = collectAppStorageFiles(extracted, options);
  return report;
}

export { formatReportAsJson } from './format.json.js';
export { formatReportAsMarkdown } from './format.markdown.js';
export type { AppStorageFilesReport, StorageFilePurposeSummary } from './types.js';
