import type { AppNotificationsReport } from './types.js';

export function formatReportAsJson(report: AppNotificationsReport): string {
  return JSON.stringify(report, null, 2);
}
