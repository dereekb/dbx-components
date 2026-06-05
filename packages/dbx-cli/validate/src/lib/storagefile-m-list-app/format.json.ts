import type { AppStorageFilesReport } from './types.js';

/**
 * Renders the storage-file listing report as pretty-printed JSON for clients
 * that want structured data instead of markdown.
 *
 * @param report - The listing report to serialise.
 * @returns The JSON string the tool emits as content.
 */
export function formatReportAsJson(report: AppStorageFilesReport): string {
  return JSON.stringify(report, null, 2);
}
