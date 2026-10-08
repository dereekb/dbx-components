/**
 * Pure rendering layer for `dbx-cli-generate-notification-manifest`.
 *
 * Delegates to {@link notificationManifest.buildNotificationManifest} in
 * `@dereekb/dbx-cli/validate` (one extraction feeding both the
 * `dbx_notification_m_list_app` report and the `dbx_notification_m_validate_app`
 * rules) behind a thin seam with an injectable `now`, so the spec can check the
 * manifest a fixture produces without touching disk. The `main.ts` entry
 * handles the filesystem inspection and output, then calls in here.
 */

import { notificationManifest, type notificationValidateApp } from '@dereekb/dbx-cli/validate';

/**
 * Renders the notification manifest from a prepared inspection.
 *
 * @param input - The app stamp, the inspection, and the workspace-relative component / API dirs.
 * @param now - Override for the `generatedAt` timestamp (tests pass a fixed value).
 * @returns The manifest and the full validator result it was derived from.
 *
 * @example
 * ```ts
 * renderNotificationManifest({ app: { name: 'demo-api' }, inspection, componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' }, new Date('2026-01-01T00:00:00.000Z'));
 * ```
 */
export function renderNotificationManifest(input: notificationManifest.BuildNotificationManifestInput, now: Date = new Date()): notificationManifest.BuildNotificationManifestResult {
  return notificationManifest.buildNotificationManifest(input, now);
}

/**
 * Formats one validator finding as a severity-prefixed stderr line. An
 * `error`-severity finding gets a second `  fix:` line when the rule catalog
 * has a canonical fix, so a failing build says what to change.
 *
 * @param violation - The validator violation (with its catalog remediation).
 * @returns The formatted log line(s).
 *
 * @example
 * ```ts
 * formatNotificationManifestFinding({ code: 'NOTIF_TEMPLATE_FACTORY_MISSING', severity: 'error', side: 'api', file: 'src/app/common/model/notification/notification.factory.ts', message: '…' });
 * // => '[generate-notification-manifest] error: NOTIF_TEMPLATE_FACTORY_MISSING (api: src/app/common/model/notification/notification.factory.ts): …'
 * ```
 */
export function formatNotificationManifestFinding(violation: notificationValidateApp.Violation): string {
  const location = violation.file ? `${violation.side}: ${violation.file}` : violation.side;
  const line = `[generate-notification-manifest] ${violation.severity}: ${violation.code} (${location}): ${violation.message}`;
  const fix = violation.severity === 'error' ? violation.remediation?.fix : undefined;
  return fix ? `${line}\n  fix: ${fix}` : line;
}

/**
 * Input to {@link countNotificationManifestGenerationErrors}.
 */
export interface CountNotificationManifestGenerationErrorsInput {
  readonly findings: readonly Pick<notificationManifest.NotificationManifestFinding, 'code' | 'severity'>[];
  readonly strict: boolean;
  /**
   * Warning CODES explicitly tolerated by `--allow-warning=<CODE>`: a
   * `warning`-severity finding with one of these codes never counts toward the
   * failure total, even under `--strict` / `--max-warnings`. `error`-severity
   * findings are NOT allowlistable.
   */
  readonly allowWarning?: readonly string[];
  /**
   * `--max-warnings=<N>`: when set, generation fails if the number of
   * non-allowlisted `warning`-severity findings exceeds this cap (independent of
   * `--strict`). `--max-warnings=0` fails on any new (non-allowlisted) warning.
   */
  readonly maxWarnings?: number;
}

/**
 * Counts the findings that should fail generation: every `error`-severity
 * finding (never allowlistable), plus the non-allowlisted `warning`-severity
 * findings when `--strict` is set or when they exceed `--max-warnings`. Mirrors
 * `countRouteManifestGenerationErrors` in `dbx-cli-generate-route-manifest`, with
 * the rule `code` in place of the warning `kind`.
 *
 * @param input - The findings, `--strict`, and the allowlist / cap.
 * @returns The number of findings that should cause a non-zero exit.
 *
 * @example
 * ```ts
 * countNotificationManifestGenerationErrors({ findings, strict: false }); // counts only error-severity findings
 * countNotificationManifestGenerationErrors({ findings, strict: true, allowWarning: ['NOTIF_TEMPLATE_INFO_MISSING_NAME_OR_DESCRIPTION'] }); // tolerates that code
 * countNotificationManifestGenerationErrors({ findings, strict: false, maxWarnings: 0 }); // fails on any new warning
 * ```
 */
export function countNotificationManifestGenerationErrors(input: CountNotificationManifestGenerationErrorsInput): number {
  const allow = new Set(input.allowWarning ?? []);
  const errorCount = input.findings.filter((finding) => finding.severity === 'error').length;
  const blockableWarnings = input.findings.filter((finding) => finding.severity === 'warning' && !allow.has(finding.code));
  const exceedsMax = input.maxWarnings !== undefined && blockableWarnings.length > input.maxWarnings;
  const blockingWarningCount = input.strict || exceedsMax ? blockableWarnings.length : 0;
  return errorCount + blockingWarningCount;
}
