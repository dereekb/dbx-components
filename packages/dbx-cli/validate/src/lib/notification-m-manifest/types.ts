/**
 * Schema of `notification.manifest.json`, the build-time artifact written by
 * `dbx-cli-generate-notification-manifest`. It is the
 * `dbx_notification_m_list_app` report plus the `dbx_notification_m_validate_app`
 * findings, both computed from one extraction.
 */

import type { AppNotificationsReport } from '../notification-m-list-app/index.js';
import type { AppNotificationsInspection, ValidationResult, Violation } from '../notification-m-validate-app/index.js';

/**
 * Version stamp embedded in `notification.manifest.json`. Bump when the shape changes incompatibly (additive fields don't need a bump).
 */
export const NOTIFICATION_MANIFEST_VERSION = 1 as const;

export interface NotificationManifestApp {
  readonly name: string;
}

/**
 * A validator finding as written into the manifest. The rule catalog's `remediation` is left out to keep the file small; `dbx_explain_rule <code>` expands it.
 */
export type NotificationManifestFinding = Pick<Violation, 'code' | 'severity' | 'message' | 'side' | 'file'>;

export interface NotificationManifest extends AppNotificationsReport {
  readonly version: typeof NOTIFICATION_MANIFEST_VERSION;
  /**
   * ISO-8601 timestamp of the generation run.
   */
  readonly generatedAt: string;
  readonly app: NotificationManifestApp;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly findings: readonly NotificationManifestFinding[];
}

export interface BuildNotificationManifestInput {
  readonly app: NotificationManifestApp;
  readonly inspection: AppNotificationsInspection;
  /**
   * Workspace-relative component dir, stamped into the manifest.
   */
  readonly componentDir: string;
  /**
   * Workspace-relative API dir, stamped into the manifest.
   */
  readonly apiDir: string;
}

export interface BuildNotificationManifestResult {
  readonly manifest: NotificationManifest;
  /**
   * The full validator result, including `remediation`, for the CLI's stderr output.
   */
  readonly validation: ValidationResult;
}
