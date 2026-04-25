import type { AppStorageFilesReport } from './types.js';

export function formatReportAsJson(report: AppStorageFilesReport): string {
  return JSON.stringify(report, null, 2);
}
