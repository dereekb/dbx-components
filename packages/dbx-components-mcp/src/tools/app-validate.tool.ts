/**
 * `dbx_app_validate` tool — aggregate validator.
 *
 * One-shot replacement for the per-domain tool dance an agent runs when
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
 *   6. `dbx_model_api_validate_app`
 *   7. `dbx_model_firebase_index_validate_app`
 *   8. `dbx_asset_validate_app` — only when `webDir` is supplied
 *      (the asset cluster targets the Angular front-end app, which is
 *      a different package from the API app).
 *   9. `dbx_model_test_validate_app` — model-test convention audit
 *      (filename drift + missing baseline CRUD specs per model group).
 *
 * Returns a severity-grouped report with each finding tagged by source
 * cluster, code, file/line, and (when the rule catalog has an entry) a
 * canonical-fix line. The remediation auto-attach lives at the
 * domain level — this tool just relays whatever each `Violation`
 * already carries.
 */

import { resolve, join } from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { attachRemediation, ensurePathInsideCwd, assetValidateApp, fixtureValidate, modelApiValidateApp, modelListComponent, modelTestValidateApp, modelValidate, modelValidateFolder, notificationValidateApp, storagefileValidateApp, systemValidateFolder, type RemediationHint } from '@dereekb/dbx-cli/validate';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { inspectAppFixtures, discoverSpecFilesByGroup } from '@dereekb/dbx-cli/model-test';
import { FIREBASE_MODELS, getDownstreamCatalog, RESERVED_MODEL_FOLDERS } from '@dereekb/dbx-cli';
import { buildModelFirebaseIndexManifest, createModelFirebaseIndexRegistryFromEntries, generateFirestoreIndexesJson, toModelFirebaseIndexEntryInfo, type FirestoreIndexesJson } from '@dereekb/dbx-cli/firestore-indexes';

const { inspectAppStorageFiles, validateAppStorageFiles } = storagefileValidateApp;
const { inspectAppNotifications, validateAppNotifications } = notificationValidateApp;
const { validateAppFixtures } = fixtureValidate;
type FixtureDiagnostic = fixtureValidate.FixtureDiagnostic;
const { inspectFolder: inspectModelFolder, validateModelFolders } = modelValidateFolder;
const { inspectFolder: inspectSystemFolder, validateSystemFolders } = systemValidateFolder;
const { checkManifestCompositeKeyFrom, checkManifestIdentityDuplicates } = modelValidate;
const { inspectAppAssets, validateAppAssets } = assetValidateApp;
const { validateAppModelApi } = modelApiValidateApp;
const { validateModelTestApp } = modelTestValidateApp;
const { extractComponentModels } = modelListComponent;

const Cluster = "'storagefile_m' | 'notification_m' | 'model_folder' | 'system_m' | 'fixture' | 'manifest' | 'model_api' | 'firebase_index' | 'asset' | 'model_test'";

const AppValidateArgsType = type({
  componentDir: 'string',
  apiDir: 'string',
  'webDir?': 'string',
  'indexesFile?': 'string',
  'format?': "'markdown' | 'json'",
  'skip?': `(${Cluster})[]`
});

type ClusterName = 'storagefile_m' | 'notification_m' | 'model_folder' | 'system_m' | 'fixture' | 'manifest' | 'model_api' | 'firebase_index' | 'asset' | 'model_test';

const TOOL: Tool = {
  name: 'dbx_app_validate',
  description: [
    'Aggregate validator for a downstream `-firebase` component + API app pair. Runs every per-domain validator (`storagefile_m`, `notification_m`, model-folder, `system_m`, fixture, manifest, `model_api`, `firebase_index`, `model_test`, optional `asset`) and returns one severity-grouped report.',
    '',
    'The `model_folder` cluster includes both folder-structure findings (canonical 5-file layout) and per-file content findings forwarded from `dbx_model_validate` — including the JSDoc-tag rules (`MODEL_IDENTITY_NOT_TAGGED`, `MODEL_GROUP_INTERFACE_MISSING_TAG`, `MODEL_INTERFACE_MISSING_TAG`) that flag downstream apps where `firestoreModelIdentity(...)` calls lack catalog tagging.',
    '',
    'The `manifest` cluster walks the merged model manifest (`@dereekb/firebase` upstream plus every discovered `*-firebase` component) and flags duplicate `firestoreModelIdentity` declarations: `MODEL_IDENTITY_COLLECTION_NAME_DUPLICATE` when two identities share their `collectionName` arg, and `MODEL_IDENTITY_MODEL_TYPE_DUPLICATE` when they share their `modelName` arg.',
    '',
    'The `model_api` cluster reconciles CRUD declarations from `<componentDir>/src/lib/**/*.api.ts` against the handler map wired in `<apiDir>/src/app/function/model/crud.functions.ts`, emitting `MISSING_HANDLER`, `ORPHAN_HANDLER`, and `HANDLER_NAMING_MISMATCH`.',
    '',
    "The `firebase_index` cluster diffs the component's `@dbxModelFirebaseIndex`-tagged factories against the committed `firestore.indexes.json`. `MODEL_FIREBASE_INDEX_COMPOSITE_ADDED` / `..._FIELD_OVERRIDE_ADDED` fire when JSON is missing required entries; the `*_REMOVED` codes warn on stale entries with no factory backing them.",
    '',
    'The `asset` cluster runs only when `webDir` is supplied — it points at the Angular front-end (e.g. `apps/demo`), which is a different package from the API app. Without `webDir` the cluster is skipped.',
    '',
    'The `model_test` cluster audits the model-test convention: filenames under `<apiDir>/src/app/function/<group>/` must be `<group>.crud[.<sub>].spec.ts` or `<group>.scenario[.<sub>].spec.ts`, and every model group on the component side must have a baseline `<group>.crud.spec.ts`. Emits `TEST_FILE_DRIFT_RENAME`, `TEST_FILE_MISSING_BUCKET`, `TEST_FILE_NON_GROUP_PLACEMENT`, and `MODEL_GROUP_MISSING_CRUD_SPEC` — all warnings.',
    '',
    'Each finding is tagged with its source cluster, code, file/line, and canonical-fix line (when the rule catalog has an entry).',
    '',
    'Inputs:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: relative path to the API app (e.g. `apps/demo-api`).',
    '- `webDir` (optional): relative path to the Angular front-end app (e.g. `apps/demo`). Required for the `asset` cluster.',
    '- `indexesFile` (optional): relative path to `firestore.indexes.json` for the `firebase_index` cluster. Defaults to `firestore.indexes.json` at the workspace root.',
    '- `format` (optional): `markdown` (default) or `json`.',
    '- `skip` (optional): clusters to opt out of (`storagefile_m`, `notification_m`, `model_folder`, `system_m`, `fixture`, `manifest`, `model_api`, `firebase_index`, `asset`, `model_test`).',
    '',
    'Use `dbx_explain_rule code="<code>"` to dig into any finding.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the component package.' },
      apiDir: { type: 'string', description: 'Relative path to the API app.' },
      webDir: { type: 'string', description: 'Relative path to the Angular front-end app (required for the `asset` cluster).' },
      indexesFile: { type: 'string', description: 'Relative path to `firestore.indexes.json` for the `firebase_index` cluster. Defaults to `firestore.indexes.json` at the workspace root.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' },
      skip: {
        type: 'array',
        items: { type: 'string', enum: ['storagefile_m', 'notification_m', 'model_folder', 'system_m', 'fixture', 'manifest', 'model_api', 'firebase_index', 'asset', 'model_test'] },
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
  const pathCheck = ensureArgPaths(parsed, cwd);
  if (pathCheck !== undefined) return pathCheck;

  const componentAbs = resolve(cwd, parsed.componentDir);
  const apiAbs = resolve(cwd, parsed.apiDir);
  const webAbs = parsed.webDir === undefined ? undefined : resolve(cwd, parsed.webDir);
  const indexesRel = parsed.indexesFile ?? 'firestore.indexes.json';
  const indexesAbs = resolve(cwd, indexesRel);
  const skip = new Set<ClusterName>(parsed.skip ?? []);

  const findings: AggregatedFinding[] = [];
  const skipped: ClusterName[] = [];
  const clusterErrors: { cluster: ClusterName; message: string }[] = [];

  await runAllClusters({
    parsed,
    cwd,
    componentAbs,
    apiAbs,
    webAbs,
    indexesAbs,
    indexesRel,
    skip,
    skipped,
    findings,
    clusterErrors
  });

  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.length - errorCount;
  const report: AggregatedReport = { componentDir: parsed.componentDir, apiDir: parsed.apiDir, findings, errorCount, warningCount, skipped, clusterErrors };
  const text = parsed.format === 'json' ? formatJson(report) : formatMarkdown(report);
  const result: ToolResult = { content: [{ type: 'text', text }], isError: errorCount > 0 || clusterErrors.length > 0 };
  return result;
}

interface ParsedAppValidateArgs {
  readonly componentDir: string;
  readonly apiDir: string;
  readonly webDir?: string;
  readonly indexesFile?: string;
  readonly format?: 'markdown' | 'json';
  readonly skip?: readonly ClusterName[];
}

function ensureArgPaths(parsed: ParsedAppValidateArgs, cwd: string): ToolResult | undefined {
  const candidates: (string | undefined)[] = [parsed.componentDir, parsed.apiDir, parsed.webDir, parsed.indexesFile];
  let result: ToolResult | undefined;
  try {
    for (const candidate of candidates) {
      if (candidate !== undefined) ensurePathInsideCwd(candidate, cwd);
    }
  } catch (err) {
    result = toolError(err instanceof Error ? err.message : String(err));
  }
  return result;
}

interface RunAllClustersInput {
  readonly parsed: ParsedAppValidateArgs;
  readonly cwd: string;
  readonly componentAbs: string;
  readonly apiAbs: string;
  readonly webAbs: string | undefined;
  readonly indexesAbs: string;
  readonly indexesRel: string;
  readonly skip: ReadonlySet<ClusterName>;
  readonly skipped: ClusterName[];
  readonly findings: AggregatedFinding[];
  readonly clusterErrors: { cluster: ClusterName; message: string }[];
}

async function runAllClusters(input: RunAllClustersInput): Promise<void> {
  const { parsed, cwd, componentAbs, apiAbs, webAbs, indexesAbs, indexesRel, skip, skipped, findings, clusterErrors } = input;
  const componentApiCtx: ComponentApiCtx = { componentAbs, apiAbs, componentRel: parsed.componentDir, apiRel: parsed.apiDir, skip, skipped, findings, clusterErrors };
  const componentOnlyCtx: ComponentOnlyCtx = { componentAbs, componentRel: parsed.componentDir, skip, skipped, findings, clusterErrors };

  await runStorageFileM(componentApiCtx);
  await runNotificationM(componentApiCtx);
  await runFixture({ apiAbs, apiRel: parsed.apiDir, skip, skipped, findings, clusterErrors });
  await runModelFolders(componentOnlyCtx);
  await runSystemFolder(componentOnlyCtx);
  await runManifest({ workspaceRoot: cwd, skip, skipped, findings, clusterErrors });
  await runModelApi(componentApiCtx);
  await runFirebaseIndex({ ...componentOnlyCtx, indexesAbs, indexesRel });
  await runAsset({ ...componentOnlyCtx, webAbs, webRel: parsed.webDir });
  await runModelTest(componentApiCtx);
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
      ctx.findings.push(toFinding({ cluster: 'storagefile_m', code: v.code, severity: v.severity, message: v.message, file: v.file, line: undefined }));
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
      ctx.findings.push(toFinding({ cluster: 'notification_m', code: v.code, severity: v.severity, message: v.message, file: v.file, line: undefined }));
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
      ctx.findings.push(toFinding({ cluster: 'model_folder', code: v.code, severity: v.severity, message: v.message, file: v.file, line: undefined }));
    }
  } catch (err) {
    ctx.clusterErrors.push({ cluster: 'model_folder', message: err instanceof Error ? err.message : String(err) });
  }
}

interface ManifestCtx extends FanOutCtx {
  readonly workspaceRoot: string;
}

async function runManifest(ctx: ManifestCtx): Promise<void> {
  if (ctx.skip.has('manifest')) {
    ctx.skipped.push('manifest');
    return;
  }
  try {
    const downstream = await getDownstreamCatalog({ workspaceRoot: ctx.workspaceRoot });
    const merged = [...FIREBASE_MODELS, ...downstream.models];
    const violations = [...checkManifestIdentityDuplicates(merged), ...checkManifestCompositeKeyFrom(merged)];
    for (const v of violations) {
      ctx.findings.push(toFinding({ cluster: 'manifest', code: v.code, severity: v.severity, message: v.message, file: v.file, line: v.line }));
    }
  } catch (err) {
    ctx.clusterErrors.push({ cluster: 'manifest', message: err instanceof Error ? err.message : String(err) });
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
      ctx.findings.push(toFinding({ cluster: 'system_m', code: v.code, severity: v.severity, message: v.message, file: v.file, line: undefined }));
    }
  } catch (err) {
    ctx.clusterErrors.push({ cluster: 'system_m', message: err instanceof Error ? err.message : String(err) });
  }
}

async function runModelApi(ctx: ComponentApiCtx): Promise<void> {
  if (ctx.skip.has('model_api')) {
    ctx.skipped.push('model_api');
    return;
  }
  try {
    const report = await validateAppModelApi({ componentAbs: ctx.componentAbs, componentDir: ctx.componentRel, apiAbs: ctx.apiAbs, apiDir: ctx.apiRel });
    for (const issue of report.issues) {
      const { file, line } = splitSource(issue.source);
      ctx.findings.push(toFinding({ cluster: 'model_api', code: issue.code, severity: 'error', message: issue.message, file, line }));
    }
  } catch (err) {
    ctx.clusterErrors.push({ cluster: 'model_api', message: err instanceof Error ? err.message : String(err) });
  }
}

interface FirebaseIndexCtx extends ComponentOnlyCtx {
  readonly indexesAbs: string;
  readonly indexesRel: string;
}

async function runFirebaseIndex(ctx: FirebaseIndexCtx): Promise<void> {
  if (ctx.skip.has('firebase_index')) {
    ctx.skipped.push('firebase_index');
    return;
  }
  try {
    const buildOutcome = await buildModelFirebaseIndexManifest({ projectRoot: ctx.componentAbs, generator: 'dbx_app_validate' });
    if (buildOutcome.kind !== 'success') {
      // No scan config / no firebase package — treat as not configured.
      ctx.skipped.push('firebase_index');
      return;
    }
    const existing = await readIndexesJson(ctx.indexesAbs);
    const entries = buildOutcome.manifest.entries.map(toModelFirebaseIndexEntryInfo);
    const registry = createModelFirebaseIndexRegistryFromEntries({ entries, loadedSources: [buildOutcome.manifest.source] });
    const { diff } = generateFirestoreIndexesJson({ entries: registry.all, existingJson: existing });
    for (const composite of diff.added) {
      ctx.findings.push(toFinding({ cluster: 'firebase_index', code: 'MODEL_FIREBASE_INDEX_COMPOSITE_ADDED', severity: 'error', message: `Required composite missing from \`${ctx.indexesRel}\`: ${composite}`, file: ctx.indexesRel, line: undefined }));
    }
    for (const composite of diff.removed) {
      ctx.findings.push(toFinding({ cluster: 'firebase_index', code: 'MODEL_FIREBASE_INDEX_COMPOSITE_REMOVED', severity: 'warning', message: `Stale composite in \`${ctx.indexesRel}\` (no factory requires it): ${composite}`, file: ctx.indexesRel, line: undefined }));
    }
    for (const fieldOverride of diff.fieldOverridesAdded) {
      ctx.findings.push(toFinding({ cluster: 'firebase_index', code: 'MODEL_FIREBASE_INDEX_FIELD_OVERRIDE_ADDED', severity: 'error', message: `Required fieldOverride missing from \`${ctx.indexesRel}\`: ${fieldOverride}`, file: ctx.indexesRel, line: undefined }));
    }
    for (const fieldOverride of diff.fieldOverridesRemoved) {
      ctx.findings.push(toFinding({ cluster: 'firebase_index', code: 'MODEL_FIREBASE_INDEX_FIELD_OVERRIDE_REMOVED', severity: 'warning', message: `Stale fieldOverride in \`${ctx.indexesRel}\` (no factory requires it): ${fieldOverride}`, file: ctx.indexesRel, line: undefined }));
    }
  } catch (err) {
    ctx.clusterErrors.push({ cluster: 'firebase_index', message: err instanceof Error ? err.message : String(err) });
  }
}

interface AssetCtx extends ComponentOnlyCtx {
  readonly webAbs: string | undefined;
  readonly webRel: string | undefined;
}

async function runAsset(ctx: AssetCtx): Promise<void> {
  if (ctx.skip.has('asset')) {
    ctx.skipped.push('asset');
    return;
  }
  if (ctx.webAbs === undefined || ctx.webRel === undefined) {
    ctx.skipped.push('asset');
    return;
  }
  try {
    const inspection = await inspectAppAssets(ctx.componentAbs, ctx.webAbs);
    const result = validateAppAssets(inspection, { componentDir: ctx.componentRel, apiDir: ctx.webRel });
    for (const v of result.violations) {
      ctx.findings.push(toFinding({ cluster: 'asset', code: v.code, severity: v.severity, message: v.message, file: v.file, line: undefined }));
    }
  } catch (err) {
    ctx.clusterErrors.push({ cluster: 'asset', message: err instanceof Error ? err.message : String(err) });
  }
}

async function runModelTest(ctx: ComponentApiCtx): Promise<void> {
  if (ctx.skip.has('model_test')) {
    ctx.skipped.push('model_test');
    return;
  }
  try {
    const specCatalog = await discoverSpecFilesByGroup({ apiAbs: ctx.apiAbs, apiRel: ctx.apiRel });
    const componentExtraction = await extractComponentModels(ctx.componentAbs);
    const result = validateModelTestApp({
      componentDir: ctx.componentRel,
      apiDir: ctx.apiRel,
      specCatalog,
      componentExtraction
    });
    for (const v of result.violations) {
      ctx.findings.push(toFinding({ cluster: 'model_test', code: v.code, severity: v.severity, message: v.message, file: v.file, line: undefined }));
    }
  } catch (err) {
    ctx.clusterErrors.push({ cluster: 'model_test', message: err instanceof Error ? err.message : String(err) });
  }
}

async function readIndexesJson(indexesAbs: string): Promise<FirestoreIndexesJson | undefined> {
  let text: string;
  try {
    text = await readFile(indexesAbs, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return undefined;
    throw err;
  }
  const parsed: unknown = JSON.parse(text);
  if (parsed === null || typeof parsed !== 'object') return undefined;
  const raw = parsed as { indexes?: unknown; fieldOverrides?: unknown };
  const indexes = Array.isArray(raw.indexes) ? (raw.indexes as FirestoreIndexesJson['indexes']) : [];
  const fieldOverrides = Array.isArray(raw.fieldOverrides) ? (raw.fieldOverrides as FirestoreIndexesJson['fieldOverrides']) : [];
  return { indexes, fieldOverrides };
}

function splitSource(source: string | undefined): { readonly file: string | undefined; readonly line: number | undefined } {
  if (source === undefined || source.length === 0) return { file: undefined, line: undefined };
  const idx = source.lastIndexOf(':');
  if (idx <= 0) return { file: source, line: undefined };
  const head = source.slice(0, idx);
  const tail = source.slice(idx + 1);
  const lineNumber = Number.parseInt(tail, 10);
  if (Number.isNaN(lineNumber)) return { file: source, line: undefined };
  return { file: head, line: lineNumber };
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
  lines.push(`# App validation: \`${report.componentDir}\` + \`${report.apiDir}\``, '', `- **Errors:** ${report.errorCount}`, `- **Warnings:** ${report.warningCount}`);
  if (report.skipped.length > 0) {
    const skippedClusters = report.skipped.map((c) => `\`${c}\``).join(', ');
    lines.push(`- **Skipped clusters:** ${skippedClusters}`);
  }
  if (report.clusterErrors.length > 0) {
    lines.push('', '## Cluster errors', '');
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
  const lineSuffix = finding.line === undefined ? '' : `:${finding.line}`;
  const fileSuffix = finding.file ? ` — \`${finding.file}\`${lineSuffix}` : '';
  out.push(`- **\`${finding.code}\`** [${finding.cluster}]${fileSuffix}`, `  ${finding.message}`);
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

export const APP_VALIDATE_TOOL: DbxTool = { definition: TOOL, run };
