/**
 * `dbx_app_validate` tool — aggregate validator.
 *
 * One-shot replacement for the six-tool dance an agent runs when
 * validating a downstream `-firebase` component + API app pair. Fans
 * out to every domain's *pure* validate function:
 *
 *   1. `dbx_storagefile_m_validate_app`
 *   2. `dbx_notification_m_validate_app`
 *   3. `dbx_model_fixture_validate_app`
 *   4. `dbx_model_validate_folder` for every direct subfolder of
 *      `<componentDir>/src/lib/model/` (skipping reserved folders
 *      that surface their own validators).
 *   5. `dbx_system_m_validate_folder` when `<componentDir>/src/lib/model/system`
 *      is present.
 *
 * Returns a severity-grouped report with each finding tagged by source
 * cluster, code, file/line, and (when the rule catalog has an entry) a
 * canonical-fix line. The remediation auto-attach lives at the
 * domain level — this tool just relays whatever each `Violation`
 * already carries.
 */

import { resolve, join } from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { attachRemediation, type RemediationHint } from './rule-catalog/index.js';
import { inspectAppStorageFiles, validateAppStorageFiles, type Violation as StorageFileViolation } from './storagefile-m-validate-app/index.js';
import { inspectAppNotifications, validateAppNotifications, type Violation as NotificationViolation } from './notification-m-validate-app/index.js';
import { inspectAppFixtures, validateAppFixtures, type FixtureDiagnostic } from './model-fixture-shared/index.js';
import { RESERVED_MODEL_FOLDERS } from './model-validate-folder/types.js';
import { inspectFolder as inspectModelFolder, validateModelFolders, type Violation as ModelFolderViolation } from './model-validate-folder/index.js';
import { inspectFolder as inspectSystemFolder, validateSystemFolders, type Violation as SystemFolderViolation } from './system-m-validate-folder/index.js';

const Cluster = "'storagefile_m' | 'notification_m' | 'model_folder' | 'system_m' | 'fixture'";

const AppValidateArgsType = type({
  componentDir: 'string',
  apiDir: 'string',
  'format?': "'markdown' | 'json'",
  'skip?': `(${Cluster})[]`
});

type ClusterName = 'storagefile_m' | 'notification_m' | 'model_folder' | 'system_m' | 'fixture';

const TOOL: Tool = {
  name: 'dbx_app_validate',
  description: [
    'Aggregate validator for a downstream `-firebase` component + API app pair. Runs every per-domain validator (`storagefile_m`, `notification_m`, model-folder, `system_m`, fixture) and returns one severity-grouped report.',
    '',
    'The `model_folder` cluster includes both folder-structure findings (canonical 5-file layout) and per-file content findings forwarded from `dbx_model_validate` — including the JSDoc-tag rules (`MODEL_IDENTITY_NOT_TAGGED`, `MODEL_GROUP_INTERFACE_MISSING_TAG`, `MODEL_INTERFACE_MISSING_TAG`) that flag downstream apps where `firestoreModelIdentity(...)` calls lack catalog tagging.',
    '',
    'Replaces the six-tool dance an agent runs to validate one app end-to-end. Each finding is tagged with its source cluster, code, file/line, and canonical-fix line (when the rule catalog has an entry).',
    '',
    'Inputs:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: relative path to the API app (e.g. `apps/demo-api`).',
    '- `format` (optional): `markdown` (default) or `json`.',
    '- `skip` (optional): clusters to opt out of (`storagefile_m`, `notification_m`, `model_folder`, `system_m`, `fixture`).',
    '',
    'Use `dbx_explain_rule code="<code>"` to dig into any finding.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the component package.' },
      apiDir: { type: 'string', description: 'Relative path to the API app.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' },
      skip: {
        type: 'array',
        items: { type: 'string', enum: ['storagefile_m', 'notification_m', 'model_folder', 'system_m', 'fixture'] },
        description: 'Clusters to opt out of.'
      }
    },
    required: ['componentDir', 'apiDir']
  }
};

interface AggregatedFinding {
  readonly cluster: ClusterName;
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly file: string | undefined;
  readonly line: number | undefined;
  readonly remediation: RemediationHint | undefined;
}

interface AggregatedReport {
  readonly componentDir: string;
  readonly apiDir: string;
  readonly findings: readonly AggregatedFinding[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly skipped: readonly ClusterName[];
  readonly clusterErrors: readonly { readonly cluster: ClusterName; readonly message: string }[];
}

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = AppValidateArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  const cwd = process.cwd();
  try {
    ensurePathInsideCwd(parsed.componentDir, cwd);
    ensurePathInsideCwd(parsed.apiDir, cwd);
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }
  const componentAbs = resolve(cwd, parsed.componentDir);
  const apiAbs = resolve(cwd, parsed.apiDir);
  const skip = new Set<ClusterName>(parsed.skip ?? []);

  const findings: AggregatedFinding[] = [];
  const skipped: ClusterName[] = [];
  const clusterErrors: { cluster: ClusterName; message: string }[] = [];

  await runStorageFileM({ componentAbs, apiAbs, componentRel: parsed.componentDir, apiRel: parsed.apiDir, skip, skipped, findings, clusterErrors });
  await runNotificationM({ componentAbs, apiAbs, componentRel: parsed.componentDir, apiRel: parsed.apiDir, skip, skipped, findings, clusterErrors });
  await runFixture({ apiAbs, apiRel: parsed.apiDir, skip, skipped, findings, clusterErrors });
  await runModelFolders({ componentAbs, componentRel: parsed.componentDir, skip, skipped, findings, clusterErrors });
  await runSystemFolder({ componentAbs, componentRel: parsed.componentDir, skip, skipped, findings, clusterErrors });

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.length - errorCount;
  const report: AggregatedReport = { componentDir: parsed.componentDir, apiDir: parsed.apiDir, findings, errorCount, warningCount, skipped, clusterErrors };
  const text = parsed.format === 'json' ? formatJson(report) : formatMarkdown(report);
  const result: ToolResult = { content: [{ type: 'text', text }], isError: errorCount > 0 || clusterErrors.length > 0 };
  return result;
}

interface FanOutCtx {
  readonly skip: ReadonlySet<ClusterName>;
  readonly skipped: ClusterName[];
  readonly findings: AggregatedFinding[];
  readonly clusterErrors: { cluster: ClusterName; message: string }[];
}

interface ComponentApiCtx extends FanOutCtx {
  readonly componentAbs: string;
  readonly apiAbs: string;
  readonly componentRel: string;
  readonly apiRel: string;
}

async function runStorageFileM(ctx: ComponentApiCtx): Promise<void> {
  if (ctx.skip.has('storagefile_m')) {
    ctx.skipped.push('storagefile_m');
    return;
  }
  try {
    const inspection = await inspectAppStorageFiles(ctx.componentAbs, ctx.apiAbs);
    const result = validateAppStorageFiles(inspection, { componentDir: ctx.componentRel, apiDir: ctx.apiRel });
    for (const v of result.violations) {
      ctx.findings.push(toFinding({ cluster: 'storagefile_m', code: v.code, severity: v.severity, message: v.message, file: (v as StorageFileViolation).file, line: undefined }));
    }
  } catch (err) {
    ctx.clusterErrors.push({ cluster: 'storagefile_m', message: err instanceof Error ? err.message : String(err) });
  }
}

async function runNotificationM(ctx: ComponentApiCtx): Promise<void> {
  if (ctx.skip.has('notification_m')) {
    ctx.skipped.push('notification_m');
    return;
  }
  try {
    const inspection = await inspectAppNotifications(ctx.componentAbs, ctx.apiAbs);
    const result = validateAppNotifications(inspection, { componentDir: ctx.componentRel, apiDir: ctx.apiRel });
    for (const v of result.violations) {
      ctx.findings.push(toFinding({ cluster: 'notification_m', code: v.code, severity: v.severity, message: v.message, file: (v as NotificationViolation).file, line: undefined }));
    }
  } catch (err) {
    ctx.clusterErrors.push({ cluster: 'notification_m', message: err instanceof Error ? err.message : String(err) });
  }
}

interface FixtureCtx extends FanOutCtx {
  readonly apiAbs: string;
  readonly apiRel: string;
}

async function runFixture(ctx: FixtureCtx): Promise<void> {
  if (ctx.skip.has('fixture')) {
    ctx.skipped.push('fixture');
    return;
  }
  try {
    const extraction = await inspectAppFixtures(ctx.apiAbs, ctx.apiRel);
    const result = validateAppFixtures(extraction, {});
    for (const d of result.diagnostics) {
      ctx.findings.push(toFinding({ cluster: 'fixture', code: d.code, severity: d.severity, message: formatFixtureMessage(d), file: extraction.fixturePath, line: d.line }));
    }
  } catch (err) {
    ctx.clusterErrors.push({ cluster: 'fixture', message: err instanceof Error ? err.message : String(err) });
  }
}

function formatFixtureMessage(d: FixtureDiagnostic): string {
  if (d.model) return `[${d.model}] ${d.message}`;
  return d.message;
}

interface ComponentOnlyCtx extends FanOutCtx {
  readonly componentAbs: string;
  readonly componentRel: string;
}

async function runModelFolders(ctx: ComponentOnlyCtx): Promise<void> {
  if (ctx.skip.has('model_folder')) {
    ctx.skipped.push('model_folder');
    return;
  }
  try {
    const modelRoot = join(ctx.componentAbs, 'src/lib/model');
    const reservedNames = new Set(RESERVED_MODEL_FOLDERS.map((r) => r.name));
    let entries: { readonly name: string; readonly isDirectory: () => boolean }[];
    try {
      entries = await readdir(modelRoot, { withFileTypes: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        ctx.skipped.push('model_folder');
        return;
      }
      throw err;
    }
    const inspections = [] as Awaited<ReturnType<typeof inspectModelFolder>>[];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (reservedNames.has(entry.name)) continue;
      const inspection = await inspectModelFolder(join(modelRoot, entry.name));
      inspections.push(inspection);
    }
    if (inspections.length === 0) {
      ctx.skipped.push('model_folder');
      return;
    }
    const result = validateModelFolders(inspections);
    for (const v of result.violations) {
      ctx.findings.push(toFinding({ cluster: 'model_folder', code: v.code, severity: v.severity, message: v.message, file: (v as ModelFolderViolation).file, line: undefined }));
    }
  } catch (err) {
    ctx.clusterErrors.push({ cluster: 'model_folder', message: err instanceof Error ? err.message : String(err) });
  }
}

async function runSystemFolder(ctx: ComponentOnlyCtx): Promise<void> {
  if (ctx.skip.has('system_m')) {
    ctx.skipped.push('system_m');
    return;
  }
  const systemPath = join(ctx.componentAbs, 'src/lib/model/system');
  try {
    let exists = true;
    try {
      const stats = await stat(systemPath);
      if (!stats.isDirectory()) exists = false;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') exists = false;
      else throw err;
    }
    if (!exists) {
      ctx.skipped.push('system_m');
      return;
    }
    const inspection = await inspectSystemFolder(systemPath);
    const result = validateSystemFolders([inspection]);
    for (const v of result.violations) {
      ctx.findings.push(toFinding({ cluster: 'system_m', code: v.code, severity: v.severity, message: v.message, file: (v as SystemFolderViolation).file, line: undefined }));
    }
  } catch (err) {
    ctx.clusterErrors.push({ cluster: 'system_m', message: err instanceof Error ? err.message : String(err) });
  }
}

interface ToFindingInput {
  readonly cluster: ClusterName;
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly file: string | undefined;
  readonly line: number | undefined;
}

function toFinding(input: ToFindingInput): AggregatedFinding {
  const remediation = attachRemediation(input.code);
  return { ...input, remediation };
}

function formatMarkdown(report: AggregatedReport): string {
  const lines: string[] = [];
  lines.push(`# App validation: \`${report.componentDir}\` + \`${report.apiDir}\``, '');
  lines.push(`- **Errors:** ${report.errorCount}`);
  lines.push(`- **Warnings:** ${report.warningCount}`);
  if (report.skipped.length > 0) {
    const skippedClusters = report.skipped.map((c) => `\`${c}\``).join(', ');
    lines.push(`- **Skipped clusters:** ${skippedClusters}`);
  }
  if (report.clusterErrors.length > 0) {
    lines.push('');
    lines.push('## Cluster errors', '');
    for (const e of report.clusterErrors) {
      lines.push(`- \`${e.cluster}\` failed: ${e.message}`);
    }
  }
  lines.push('');
  if (report.findings.length === 0) {
    lines.push('No findings.');
    return lines.join('\n').trimEnd();
  }
  const errors = report.findings.filter((f) => f.severity === 'error');
  const warnings = report.findings.filter((f) => f.severity === 'warning');
  if (errors.length > 0) {
    lines.push('## Errors', '');
    for (const f of errors) lines.push(...renderFinding(f));
  }
  if (warnings.length > 0) {
    lines.push('## Warnings', '');
    for (const f of warnings) lines.push(...renderFinding(f));
  }
  return lines.join('\n').trimEnd();
}

function renderFinding(finding: AggregatedFinding): string[] {
  const out: string[] = [];
  const lineSuffix = finding.line !== undefined ? `:${finding.line}` : '';
  const fileSuffix = finding.file ? ` — \`${finding.file}\`${lineSuffix}` : '';
  out.push(`- **\`${finding.code}\`** [${finding.cluster}]${fileSuffix}`);
  out.push(`  ${finding.message}`);
  if (finding.remediation) {
    out.push(`  - Fix: ${finding.remediation.fix}`);
    if (finding.remediation.template) {
      out.push('  - Template:');
      for (const tline of finding.remediation.template.split('\n')) {
        out.push(`      ${tline}`);
      }
    }
    if (finding.remediation.seeAlso && finding.remediation.seeAlso.length > 0) {
      const refs = finding.remediation.seeAlso.map((r) => `${r.kind}:\`${r.target}\``).join(', ');
      out.push(`  - See also: ${refs}`);
    }
  }
  out.push('');
  return out;
}

function formatJson(report: AggregatedReport): string {
  return JSON.stringify(report, null, 2);
}

export const appValidateTool: DbxTool = { definition: TOOL, run };
