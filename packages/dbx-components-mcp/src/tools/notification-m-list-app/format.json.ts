import type { AppNotificationsReport } from './types.js';

/**
 * Renders the listing report as pretty-printed JSON for clients that want
 * structured data instead of markdown.
 *
 * @param report - the listing report to serialise
 * @returns the JSON string the tool emits as content
 */
export function formatReportAsJson(report: AppNotificationsReport): string {
  return JSON.stringify(report, null, 2);
}
