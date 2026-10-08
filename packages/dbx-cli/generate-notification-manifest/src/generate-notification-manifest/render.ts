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
import { type CliNotificationManifest, type CliNotificationManifestTask, type CliNotificationManifestTemplate } from '@dereekb/dbx-cli';

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

// MARK: CLI Manifest
/**
 * Delivery method code (the `NotificationDeliveryMethod` enum value in `@dereekb/firebase`) for each enum member name the extractor reports.
 */
const NOTIFICATION_DELIVERY_METHOD_CODES: Readonly<Record<notificationValidateApp.NotificationDeliveryMethodName, string>> = {
  EMAIL: 'e',
  TEXT: 't',
  PUSH: 'p',
  NOTIFICATION_SUMMARY: 'n'
};

/**
 * Maps the build-time notification manifest to the structural {@link CliNotificationManifest} an app CLI ships.
 *
 * Entries without a type code are skipped, delivery method enum member names become codes, and both lists are sorted by type.
 *
 * @param manifest - The manifest from {@link renderNotificationManifest}.
 * @returns The CLI manifest.
 */
export function cliNotificationManifestFromManifest(manifest: Pick<notificationManifest.NotificationManifest, 'tasks' | 'templates'>): CliNotificationManifest {
  const tasks: CliNotificationManifestTask[] = [];
  const templates: CliNotificationManifestTemplate[] = [];

  for (const task of manifest.tasks) {
    if (task.typeCode) {
      tasks.push({
        type: task.typeCode,
        symbolName: task.symbolName,
        ...(task.dataInterfaceName ? { dataInterfaceName: task.dataInterfaceName } : {}),
        checkpoints: [...task.checkpoints],
        hasHandler: task.hasHandler,
        ...(task.handlerFlowStepCount == null ? {} : { handlerFlowStepCount: task.handlerFlowStepCount }),
        sourceFile: task.sourceFile
      });
    }
  }

  for (const template of manifest.templates) {
    if (template.typeCode) {
      templates.push({
        type: template.typeCode,
        symbolName: template.symbolName,
        ...(template.factoryFunctionName ? { factoryFunctionName: template.factoryFunctionName } : {}),
        factoryContentDeliveryMethods: template.factoryContentDeliveryMethods.map((name) => NOTIFICATION_DELIVERY_METHOD_CODES[name]),
        ...(template.forcedDeliveryMethods?.length ? { forcedDeliveryMethods: template.forcedDeliveryMethods.map((name) => NOTIFICATION_DELIVERY_METHOD_CODES[name]) } : {}),
        sourceFile: template.sourceFile
      });
    }
  }

  const byType = (a: { readonly type: string }, b: { readonly type: string }) => a.type.localeCompare(b.type);
  return { tasks: tasks.sort(byType), templates: templates.sort(byType) };
}

/**
 * Input to {@link renderCliNotificationManifestSource}.
 */
export interface RenderCliNotificationManifestSourceInput {
  readonly manifest: CliNotificationManifest;
  /**
   * Project name shown in the regenerate banner.
   */
  readonly projectName: string;
  /**
   * Prefix of the emitted constants, e.g. `DEMO_CLI` for `DEMO_CLI_NOTIFICATION_MANIFEST`.
   */
  readonly namespace: string;
  /**
   * This generator's version, emitted as `<namespace>_NOTIFICATION_MANIFEST_STAMP.generatorVersion`.
   */
  readonly generatorVersion: string;
}

/**
 * Renders the unformatted TS module for `--cli-output`. `main.ts` formats it with the workspace oxfmt config before writing.
 *
 * @param input - The CLI manifest, project name, constant prefix and generator version.
 * @returns The module source.
 *
 * @example
 * ```ts
 * renderCliNotificationManifestSource({ manifest, projectName: 'demo-cli', namespace: 'DEMO_CLI', generatorVersion: '14.0.0' });
 * // => "... export const DEMO_CLI_NOTIFICATION_MANIFEST: CliNotificationManifest = { ... };"
 * ```
 */
export function renderCliNotificationManifestSource(input: RenderCliNotificationManifestSourceInput): string {
  const { manifest, projectName, namespace, generatorVersion } = input;

  return `// AUTO-GENERATED — DO NOT EDIT.
// Run \`npx nx run ${projectName}:generate-notification-manifest\` to refresh.

import { type CliGeneratedManifestStamp, type CliNotificationManifest } from '@dereekb/dbx-cli';

export const ${namespace}_NOTIFICATION_MANIFEST_STAMP: CliGeneratedManifestStamp = { generatorVersion: ${JSON.stringify(generatorVersion)} };

export const ${namespace}_NOTIFICATION_MANIFEST: CliNotificationManifest = ${JSON.stringify(manifest, null, 2)};
`;
}

/**
 * Derives the constant prefix from the project name, e.g. `demo-cli` → `DEMO_CLI`.
 *
 * @param projectName - The `--project` flag.
 * @returns The prefix; `CLI` when no project is given.
 */
export function cliNotificationManifestNamespace(projectName: string | undefined): string {
  return (projectName ?? 'cli').replaceAll(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
}
