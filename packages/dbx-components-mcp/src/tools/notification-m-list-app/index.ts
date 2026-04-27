/**
 * Pure entry point for the list tool. Callers pass a prepared
 * `AppNotificationsInspection` and receive an {@link AppNotificationsReport}.
 */

import { extractAppNotifications, type AppNotificationsInspection } from '../notification-m-validate-app/index.js';
import { collectAppNotifications } from './collect.js';
import type { AppNotificationsReport } from './types.js';

export interface ListAppNotificationsOptions {
  readonly componentDir: string;
  readonly apiDir: string;
}

/**
 * Pure listing entry point. Reuses the validator's extraction step and reshapes
 * the output into the listing report so registration state and validator
 * findings stay in sync.
 *
 * @param inspection - the prepared filesystem inspection (component + api files)
 * @param options - workspace directories used to relativise emitted paths
 * @returns the listing report
 */
export function listAppNotifications(inspection: AppNotificationsInspection, options: ListAppNotificationsOptions): AppNotificationsReport {
  const extracted = extractAppNotifications(inspection);
  return collectAppNotifications(extracted, options);
}

export { formatReportAsJson } from './format.json.js';
export { formatReportAsMarkdown } from './format.markdown.js';
export type { AppNotificationsReport, TaskSummary, TemplateSummary } from './types.js';
