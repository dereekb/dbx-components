/**
 * Pure entry point for the list tool. Callers pass a prepared
 * `AppNotificationsInspection` and receive an {@link AppNotificationsReport}.
 */

import { extractAppNotifications, type AppNotificationsInspection } from '../notification-model-validate-app/index.js';
import { collectAppNotifications } from './collect.js';
import type { AppNotificationsReport } from './types.js';

export interface ListAppNotificationsOptions {
  readonly componentDir: string;
  readonly apiDir: string;
}

export function listAppNotifications(inspection: AppNotificationsInspection, options: ListAppNotificationsOptions): AppNotificationsReport {
  const extracted = extractAppNotifications(inspection);
  const report = collectAppNotifications(extracted, options);
  return report;
}

export { formatReportAsJson } from './format.json.js';
export { formatReportAsMarkdown } from './format.markdown.js';
export type { AppNotificationsReport, TaskSummary, TemplateSummary } from './types.js';
