/**
 * Pure builder for `notification.manifest.json`. Walks the AST once and feeds
 * the same extraction to the list reshaping and the validator rules, so the
 * manifest, `dbx_notification_m_list_app` and `dbx_notification_m_validate_app`
 * agree by construction.
 */

import { collectAppNotifications } from '../notification-m-list-app/index.js';
import { extractAppNotifications, validateExtractedAppNotifications, type Violation } from '../notification-m-validate-app/index.js';
import { NOTIFICATION_MANIFEST_VERSION, type BuildNotificationManifestInput, type BuildNotificationManifestResult, type NotificationManifest, type NotificationManifestFinding } from './types.js';

/**
 * Builds the notification manifest and the validator result it was derived from.
 *
 * @param input - The app stamp, the prepared inspection, and the workspace-relative dirs.
 * @param now - Clock used for `generatedAt`; pass a fixed date for stable output.
 * @returns The manifest plus the full validation result.
 */
export function buildNotificationManifest(input: BuildNotificationManifestInput, now: Date = new Date()): BuildNotificationManifestResult {
  const { app, inspection, componentDir, apiDir } = input;
  const extracted = extractAppNotifications(inspection);
  const report = collectAppNotifications(extracted, { componentDir, apiDir });
  const validation = validateExtractedAppNotifications({ inspection, extracted, componentDir, apiDir });
  const manifest: NotificationManifest = {
    version: NOTIFICATION_MANIFEST_VERSION,
    generatedAt: now.toISOString(),
    app: { name: app.name },
    ...report,
    errorCount: validation.errorCount,
    warningCount: validation.warningCount,
    findings: validation.violations.map(notificationManifestFindingFromViolation)
  };
  const result: BuildNotificationManifestResult = { manifest, validation };
  return result;
}

/**
 * Drops the catalog `remediation` from a validator violation for the manifest.
 *
 * @param violation - The validator violation.
 * @returns The manifest finding.
 */
export function notificationManifestFindingFromViolation(violation: Violation): NotificationManifestFinding {
  const result: NotificationManifestFinding = {
    code: violation.code,
    severity: violation.severity,
    message: violation.message,
    side: violation.side,
    file: violation.file
  };
  return result;
}
