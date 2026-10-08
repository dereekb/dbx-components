/**
 * Generates `notification.manifest.json` for an app and fails the build on
 * broken notification wiring.
 *
 * Pipeline (build-time, run via `nx run <app-api>:generate-notification-manifest`):
 *
 *   1. Read the `-firebase` component's `src/lib/model/notification/**` and the
 *      API's `src/app/common/model/notification/**` + `src/app/common/firebase/**`
 *      (non-spec `.ts`) into an in-memory inspection — the same files
 *      `dbx_notification_m_validate_app` scans.
 *   2. Run the pure {@link renderNotificationManifest} (→ `buildNotificationManifest`):
 *      one extraction feeding both the `dbx_notification_m_list_app` report and
 *      the `dbx_notification_m_validate_app` rules.
 *   3. Write the result to `<output>.tmp`, then rename it to `<output>` so partial
 *      files never land on disk.
 *
 * Each finding is logged with a severity-aware prefix. Validator `error`
 * findings (a template type without a message factory, a factory without an
 * info, a `validate` task type without a handler, a wrong `--component-dir` /
 * `--api-dir`, ...) fail generation (exit 1) and delete any manifest an earlier,
 * passing run left behind, so the build fails before deploy. `warning` findings
 * are written into the manifest's `findings` and do not fail it unless
 * `--strict` / `--max-warnings` say so. The runtime startup checks in
 * `@dereekb/firebase-server/model` stay as the backstop.
 *
 * Flags:
 *   --component-dir=<path>   (required) the app's `-firebase` component root (workspace-relative or absolute).
 *   --api-dir=<path>         (required) the API app root.
 *   --output=<path>          (required) destination JSON path (workspace-relative ok).
 *   --app=<name>             (optional) app name stamped onto the manifest; defaults to the basename of --api-dir.
 *   --strict                 (optional) promote all warnings to errors for the exit decision.
 *   --allow-warning=<CODE>   (optional, repeatable) tolerate a warning rule code (never fails generation,
 *                            even under --strict / --max-warnings).
 *   --max-warnings=<N>       (optional) fail when non-allowlisted warnings exceed N (0 = no new warnings).
 */

import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import { notificationValidateApp } from '@dereekb/dbx-cli/validate';
import { countNotificationManifestGenerationErrors, formatNotificationManifestFinding, renderNotificationManifest } from './render';

interface Flags {
  readonly componentDir: string | undefined;
  readonly apiDir: string | undefined;
  readonly output: string | undefined;
  readonly app: string | undefined;
  /**
   * When true, all warnings are promoted to errors for the exit decision, so any
   * finding fails generation.
   */
  readonly strict: boolean;
  /**
   * Warning rule codes (from `--allow-warning=<CODE>`, repeatable) explicitly
   * tolerated: a `warning`-severity finding with one of these codes never fails
   * generation, even under `--strict` / `--max-warnings`.
   */
  readonly allowWarning: readonly string[];
  /**
   * `--max-warnings=<N>`: fail generation when the non-allowlisted
   * `warning`-severity findings exceed N. Undefined disables the cap.
   */
  readonly maxWarnings: number | undefined;
}

const WORKSPACE_ROOT = process.cwd();

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.componentDir == null || flags.apiDir == null || flags.output == null) {
    printUsageAndExit();
    return;
  }

  const componentPath = resolveWorkspacePath(flags.componentDir);
  const apiPath = resolveWorkspacePath(flags.apiDir);
  const outputPath = resolveWorkspacePath(flags.output);
  const outputDisplay = toDisplayPath(outputPath);

  const inspection = await notificationValidateApp.inspectAppNotifications(componentPath, apiPath);
  const app = { name: flags.app ?? basename(apiPath) };
  const { manifest, validation } = renderNotificationManifest({ app, inspection, componentDir: toDisplayPath(componentPath), apiDir: toDisplayPath(apiPath) });

  for (const violation of validation.violations) {
    console.error(formatNotificationManifestFinding(violation));
  }

  // A validator error is wiring the server rejects at startup (or a mis-pointed dir) — fail the build
  // (this generator runs via the API build dependency) and drop any manifest an earlier, passing run
  // wrote, so no stale "clean" manifest survives. `--strict` / `--max-warnings` escalate warnings.
  const blockingCount = countNotificationManifestGenerationErrors({ findings: manifest.findings, strict: flags.strict, allowWarning: flags.allowWarning, ...(flags.maxWarnings == null ? {} : { maxWarnings: flags.maxWarnings }) });
  if (blockingCount > 0) {
    await rm(outputPath, { force: true });
    console.error(`generate-notification-manifest: ${blockingCount} blocking issue(s)${describeGate(flags)}; not writing ${outputDisplay}. dbx_notification_m_validate_app reports the same findings with remediation.`);
    process.exit(1);
  }

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  await ensureOutputDir(dirname(outputPath));
  const tmpPath = `${outputPath}.tmp`;
  await writeFile(tmpPath, serialized);
  await rename(tmpPath, outputPath);

  console.log(`[wrote] ${outputDisplay} — ${manifest.templates.length} templates, ${manifest.tasks.length} tasks, ${manifest.warningCount} warning(s)`);
}

function describeGate(flags: Flags): string {
  let result = '';
  if (flags.strict) {
    result = ' (--strict)';
  } else if (flags.maxWarnings != null) {
    result = ` (--max-warnings=${flags.maxWarnings})`;
  }
  return result;
}

async function ensureOutputDir(outputDir: string): Promise<void> {
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }
}

function resolveWorkspacePath(value: string): string {
  return isAbsolute(value) ? value : resolve(WORKSPACE_ROOT, value);
}

/**
 * Workspace-relative POSIX path for paths inside the workspace; the absolute
 * POSIX path otherwise.
 *
 * @param absolutePath - The resolved path.
 * @returns The path stamped into the manifest and printed in logs.
 */
function toDisplayPath(absolutePath: string): string {
  const rel = relative(WORKSPACE_ROOT, absolutePath);
  const display = rel.startsWith('..') || isAbsolute(rel) ? absolutePath : rel;
  return display.split(sep).join('/');
}

function parseFlags(argv: readonly string[]): Flags {
  const allowWarning: string[] = [];
  let componentDir: string | undefined;
  let apiDir: string | undefined;
  let output: string | undefined;
  let app: string | undefined;
  let strict = false;
  let maxWarnings: number | undefined;

  for (const arg of argv) {
    if (arg.startsWith('--component-dir=')) {
      componentDir = arg.slice('--component-dir='.length);
    } else if (arg.startsWith('--api-dir=')) {
      apiDir = arg.slice('--api-dir='.length);
    } else if (arg.startsWith('--output=')) {
      output = arg.slice('--output='.length);
    } else if (arg.startsWith('--app=')) {
      app = arg.slice('--app='.length);
    } else if (arg.startsWith('--allow-warning=')) {
      const code = arg.slice('--allow-warning='.length).trim();
      if (code.length > 0) {
        allowWarning.push(code);
      }
    } else if (arg.startsWith('--max-warnings=')) {
      const parsed = Number.parseInt(arg.slice('--max-warnings='.length), 10);
      maxWarnings = Number.isNaN(parsed) ? undefined : Math.max(0, parsed);
    } else if (arg === '--strict') {
      strict = true;
    }
  }

  return { componentDir, apiDir, output, app, strict, allowWarning, maxWarnings };
}

function printUsageAndExit(): void {
  console.error(String.raw`generate-notification-manifest

Usage:
  node dist/packages/dbx-cli/generate-notification-manifest/main.js \
    --component-dir=components/demo-firebase \
    --api-dir=apps/demo-api \
    --app=demo-api \
    --output=dist/apps/demo-api/notification.manifest.json

Required flags:
  --component-dir=<path>     The app's -firebase component root (workspace-relative or absolute).
                             Scans src/lib/model/notification/**.
  --api-dir=<path>           The API app root. Scans src/app/common/model/notification/** and
                             src/app/common/firebase/**.
  --output=<path>            Path to the notification manifest JSON to write (workspace-relative ok).

Optional:
  --app=<name>               App name stamped onto the manifest (default: basename of --api-dir).
  --strict                   Promote all warnings to errors for the exit decision
                             (any finding then fails generation).
  --allow-warning=<CODE>     Tolerate a warning rule code (repeatable), e.g.
                             NOTIF_TEMPLATE_FACTORY_UNLISTED_DELIVERY_METHOD; it never fails generation,
                             even under --strict / --max-warnings. Error codes cannot be allowed.
  --max-warnings=<N>         Fail when non-allowlisted warnings exceed N (0 = fail on any new warning).

Validator errors always fail generation (exit 1) and remove any existing output file.
dbx_notification_m_validate_app reports the same findings with remediation.`);
  process.exit(1);
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
