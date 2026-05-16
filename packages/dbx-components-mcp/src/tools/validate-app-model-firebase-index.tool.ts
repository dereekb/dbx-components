/**
 * `dbx_model_firebase_index_validate_app` tool.
 *
 * Runs the model-firebase-index extractor + analyzer against a downstream
 * `-firebase` component, then diffs the resulting required composite +
 * fieldOverride set against the app's committed `firestore.indexes.json`.
 *
 * Pass/fail semantics:
 *
 *   - **added**: indexes/fieldOverrides the factories require but the
 *     committed file is missing → CI-fail; run the generator and commit.
 *   - **removed**: indexes/fieldOverrides in the committed file that no
 *     factory requires → likely stale (console-only), hand-tuned (should be
 *     `@dbxModelFirebaseIndexManual`-tagged), or a candidate for deletion.
 *   - **unchanged**: indexes/fieldOverrides that match → reported for
 *     completeness in JSON mode only.
 *
 * `firestore.indexes.json` is resolved relative to the workspace root
 * (defaults to `firestore.indexes.json` at the workspace root, the
 * canonical hellosubs layout).
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { buildModelFirebaseIndexManifest, type ModelFirebaseIndexBuildWarning } from '../scan/model-firebase-index-build-manifest.js';
import { createModelFirebaseIndexRegistryFromEntries, toModelFirebaseIndexEntryInfo } from '../registry/model-firebase-index-runtime.js';
import { generateFirestoreIndexesJson, type FirestoreIndexesJson, type FirestoreIndexesDiff } from '../scan/firestore-indexes-generate.js';

// MARK: Args
const ValidateAppArgsType = type({
  componentDir: 'string',
  'indexesFile?': 'string',
  'format?': "'markdown' | 'json'"
});

// MARK: Tool definition
const DBX_MODEL_FIREBASE_INDEX_VALIDATE_APP_TOOL: Tool = {
  name: 'dbx_model_firebase_index_validate_app',
  description: [
    "Validate an app's `firestore.indexes.json` against the model-firebase-index extractor.",
    '',
    'Runs the extractor + analyzer against a `-firebase` component, then diffs the required composite + fieldOverride set against the committed `firestore.indexes.json`. Reports:',
    '  • `added` — required by factories, missing from JSON (CI-fail signal — regenerate the file and commit).',
    '  • `removed` — present in JSON, no factory requires it (stale, or hand-managed and should be `@dbxModelFirebaseIndexManual`-tagged).',
    '  • `unchanged` — match (markdown summary, JSON detail).',
    '',
    'Provide:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/hellosubs-firebase`).',
    '- `indexesFile` (optional): relative path to `firestore.indexes.json`. Defaults to `firestore.indexes.json` at the server cwd (workspace root).',
    '- `format` (optional): `markdown` (default) or `json`.',
    '',
    'Paths escaping the server cwd are rejected.',
    '',
    '## Tagging a query factory',
    '',
    'The extractor only sees exported `function` declarations marked with `@dbxModelFirebaseIndex`. Tag every constraint factory whose composite or fieldOverride should appear in `firestore.indexes.json`:',
    '',
    '```ts',
    '/**',
    ' * @dbxModelFirebaseIndex',
    ' * @dbxModelFirebaseIndexModel JobApplication   // required — resolves to the Firestore collection',
    ' */',
    'export function jobApplicationsQuery(): FirestoreQueryConstraint[] {',
    "  return [where<JobApplication>('s', '==', 'a'), orderBy<JobApplication>('cat', 'asc')];",
    '}',
    '```',
    '',
    'Optional tags:',
    '- `@dbxModelFirebaseIndexScope COLLECTION | COLLECTION_GROUP` — overrides the default (COLLECTION for root models, COLLECTION_GROUP for nested).',
    '- `@dbxModelFirebaseIndexDispatcher` — marks a function as a *dispatcher*: it must only delegate to other tagged query functions via `switch`/`if`/`return` and must NOT call `where`, `orderBy`, or any helper itself. Dispatchers emit no index of their own; they exist so callers have a single entry-point that picks the right per-index function based on a mode/type parameter. See "Dispatcher pattern" below.',
    '- `@dbxModelFirebaseIndexPath <field>, <field>, ...` — one sequence per tag, filtered to the listed fields (preserves declared order). Use when a static body has multiple `where`/`orderBy` calls and you want to emit multiple composites from it. NOTE: as of this version the body must be branch-free; previously this tag was the escape hatch for `if`-branched bodies, but those now error with `complex-query-body`.',
    "- `@dbxModelFirebaseIndexSkip` — do not emit this factory's own index. Its body still contributes constraints to callers via transitive splicing.",
    '- `@dbxModelFirebaseIndexManual` — author manages this index by hand; the generator skips it but the deployed shape is treated as expected (no `removed` drift).',
    '- `@dbxModelFirebaseIndexCategory`, `@dbxModelFirebaseIndexTags`, `@dbxModelFirebaseIndexSlug`, `@dbxModelFirebaseIndexRelated`, `@dbxModelFirebaseIndexSkillRefs` — lookup/search metadata; no effect on index generation.',
    '',
    '## One query function per target index',
    '',
    'Tagged query bodies must be **branch-free**: no `if` / `else`, no `switch`, no ternary (`?:`), no `for` / `while` / `do` loops. Each tagged function produces exactly one constraint shape and therefore exactly one composite/fieldOverride. Express variation by writing multiple tagged functions and routing between them with a dispatcher.',
    '',
    '```ts',
    '/**',
    ' * @dbxModelFirebaseIndex',
    ' * @dbxModelFirebaseIndexModel JobDigest',
    ' */',
    'export function jobDigestsQuery(params: JobDigestsQueryParams): FirestoreQueryConstraint[] {',
    '  const { now, type } = params;',
    "  return [where<JobDigest>('t', 'in', type), ...whereDateIsBeforeWithSort<JobDigest>('dat', now ?? undefined, 'asc')];",
    '}',
    '```',
    '',
    '## Dispatcher pattern',
    '',
    'When the calling code needs a single entry-point that picks between several per-index query functions, write a dispatcher:',
    '',
    '```ts',
    '/**',
    ' * @dbxModelFirebaseIndex',
    ' * @dbxModelFirebaseIndexModel Job',
    ' * @dbxModelFirebaseIndexDispatcher',
    ' */',
    'export function jobsQuery(params: JobsQueryParams): FirestoreQueryConstraint[] {',
    '  switch (params.kind) {',
    "    case 'byDistrict': return jobsByDistrictQuery(params);",
    "    case 'byWeek':     return jobsByWeekQuery(params);",
    '    default:           return jobsByStatusQuery(params);',
    '  }',
    '}',
    '```',
    '',
    'Each `case` returns the result of a per-index query function. The dispatcher itself never calls `where`/`orderBy` and emits no index.',
    '',
    '## Transitive composition',
    '',
    "When a tagged factory `A` calls another exported function `B` that returns `FirestoreQueryConstraint` / `FirestoreQueryConstraint[]`, the extractor splices `B`'s body into `A`'s sequence at the call site. `B` must also be tagged `@dbxModelFirebaseIndex` (or marked `@dbxModelFirebaseIndexSkip` when it's a shared helper that shouldn't emit its own composite). Untagged constraint helpers raise `unannotated-query-helper`.",
    '',
    '## Diagnostic reference',
    '',
    'Errors (validation fails when any are present):',
    '- `complex-query-body` — a tagged query body uses `if` / `switch` / ternary / loop. Split into one tagged function per target index (each must be branch-free), or — if this function is only routing to other tagged queries — add `@dbxModelFirebaseIndexDispatcher`. See "Dispatcher pattern" above.',
    '- `non-delegating-dispatcher` — a `@dbxModelFirebaseIndexDispatcher`-tagged function calls `where` / `orderBy` / a registered helper directly. Move the constraint construction into a sibling tagged function and have the dispatcher branch return its result instead.',
    '',
    'Warnings (advisory, do not fail the run):',
    '- `missing-paths` — legacy: a body has conditional fields without `@dbxModelFirebaseIndexPath`. New code paths now error with `complex-query-body` first; this warning only fires when a tagged body somehow has conditional fields after the structural check skipped it.',
    '- `unknown-path-field` — a path tag references a field no `where`/`orderBy`/helper call produces. Fix the field list or extend the body.',
    "- `unannotated-query-helper` — a transitive callee returns `FirestoreQueryConstraint(s)` but isn't tagged. Tag the callee or mark it `@dbxModelFirebaseIndexSkip`.",
    '- `transitive-cycle` — `A → B → A` (or longer); break the recursion in source.',
    "- `unresolvable-transitive-callee` — callee's declaration isn't reachable (likely a cross-package `.d.ts` import). Inline the constraint locally or extend `FIRESTORE_QUERY_HELPERS` in `dbx-components-mcp`.",
    '- `unresolved-field` — a `where`/`orderBy` call uses a non-literal field-path argument; switch to a string literal so the extractor can read it.',
    '- `unsupported-array-contains-any`, `multiple-range-fields`, `orderby-conflict` — Firestore index-shape issues; restructure the query.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the `-firebase` component package.' },
      indexesFile: { type: 'string', description: 'Relative path to `firestore.indexes.json`. Defaults to `firestore.indexes.json` at the workspace root.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['componentDir']
  }
};

// MARK: Report shapes
interface ValidateAppReport {
  readonly componentDir: string;
  readonly indexesFile: string;
  readonly indexesFileExists: boolean;
  readonly drift: boolean;
  readonly diff: FirestoreIndexesDiff;
  readonly generatedComposites: number;
  readonly generatedFieldOverrides: number;
  readonly existingComposites: number;
  readonly existingFieldOverrides: number;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

// MARK: Tool factory
/**
 * Builds the `dbx_model_firebase_index_validate_app` tool.
 *
 * @returns a registered {@link DbxTool} ready to add to the dispatch table
 * @__NO_SIDE_EFFECTS__
 */
export function createValidateAppModelFirebaseIndexTool(): DbxTool {
  async function run(rawArgs: unknown): Promise<ToolResult> {
    const parsed = ValidateAppArgsType(rawArgs);
    if (parsed instanceof type.errors) {
      return toolError(`Invalid arguments: ${parsed.summary}`);
    }
    const cwd = process.cwd();
    try {
      ensurePathInsideCwd(parsed.componentDir, cwd);
      if (parsed.indexesFile !== undefined) {
        ensurePathInsideCwd(parsed.indexesFile, cwd);
      }
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err));
    }

    const indexesRelative = parsed.indexesFile ?? 'firestore.indexes.json';
    const componentAbs = resolve(cwd, parsed.componentDir);
    const indexesAbs = resolve(cwd, indexesRelative);

    let report: ValidateAppReport;
    try {
      report = await buildValidateAppReport({ componentDir: parsed.componentDir, componentAbs, indexesRelative, indexesAbs });
    } catch (err) {
      return toolError(`Failed to validate component firebase indexes: ${err instanceof Error ? err.message : String(err)}`);
    }

    const text = parsed.format === 'json' ? formatReportAsJson(report) : formatReportAsMarkdown(report);
    const result: ToolResult = { content: [{ type: 'text', text }] };
    if (report.drift) {
      return { ...result, isError: true };
    }
    return result;
  }

  return { definition: DBX_MODEL_FIREBASE_INDEX_VALIDATE_APP_TOOL, run };
}

// MARK: Walking
interface BuildValidateAppReportInput {
  readonly componentDir: string;
  readonly componentAbs: string;
  readonly indexesRelative: string;
  readonly indexesAbs: string;
}

async function buildValidateAppReport(input: BuildValidateAppReportInput): Promise<ValidateAppReport> {
  const { componentDir, componentAbs, indexesRelative, indexesAbs } = input;

  const buildOutcome = await buildModelFirebaseIndexManifest({
    projectRoot: componentAbs,
    generator: 'dbx_model_firebase_index_validate_app'
  });

  if (buildOutcome.kind !== 'success') {
    return emptyReport(componentDir, indexesRelative, formatBuildFailure(buildOutcome));
  }

  const { existingJson, exists: indexesFileExists, readError } = await readExistingIndexesJson(indexesAbs);
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const buildWarning of buildOutcome.extractWarnings) {
    const message = formatBuildWarning(buildWarning);
    if (isErrorSeverity(buildWarning)) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }
  if (readError !== undefined) {
    warnings.push(`Could not read existing \`${indexesRelative}\`: ${readError}`);
  }

  const entries = buildOutcome.manifest.entries.map(toModelFirebaseIndexEntryInfo);
  const registry = createModelFirebaseIndexRegistryFromEntries({ entries, loadedSources: [buildOutcome.manifest.source] });
  const { json, diff } = generateFirestoreIndexesJson({ entries: registry.all, existingJson });

  const drift = errors.length > 0 || diff.added.length > 0 || diff.removed.length > 0 || diff.fieldOverridesAdded.length > 0 || diff.fieldOverridesRemoved.length > 0;

  const report: ValidateAppReport = {
    componentDir,
    indexesFile: indexesRelative,
    indexesFileExists,
    drift,
    diff,
    generatedComposites: json.indexes.length,
    generatedFieldOverrides: json.fieldOverrides.length,
    existingComposites: existingJson?.indexes.length ?? 0,
    existingFieldOverrides: existingJson?.fieldOverrides.length ?? 0,
    errors,
    warnings
  };
  return report;
}

function isErrorSeverity(buildWarning: ModelFirebaseIndexBuildWarning): boolean {
  return buildWarning.stage === 'extract' && buildWarning.warning.severity === 'error';
}

async function readExistingIndexesJson(indexesAbs: string): Promise<{ readonly existingJson?: FirestoreIndexesJson; readonly exists: boolean; readonly readError?: string }> {
  let text: string | null = null;
  let readError: string | undefined;
  try {
    text = await readFile(indexesAbs, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return { exists: false };
    }
    readError = err instanceof Error ? err.message : String(err);
  }
  if (text === null) {
    return { exists: false, readError };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { exists: true, readError: err instanceof Error ? err.message : String(err) };
  }
  if (parsed === null || typeof parsed !== 'object') {
    return { exists: true, readError: 'Top-level value is not an object.' };
  }
  const raw = parsed as { indexes?: unknown; fieldOverrides?: unknown };
  const indexes = Array.isArray(raw.indexes) ? (raw.indexes as FirestoreIndexesJson['indexes']) : [];
  const fieldOverrides = Array.isArray(raw.fieldOverrides) ? (raw.fieldOverrides as FirestoreIndexesJson['fieldOverrides']) : [];
  return { exists: true, existingJson: { indexes, fieldOverrides } };
}

function formatBuildFailure(buildOutcome: Exclude<Awaited<ReturnType<typeof buildModelFirebaseIndexManifest>>, { readonly kind: 'success' }>): string {
  let message: string;
  switch (buildOutcome.kind) {
    case 'no-config':
      message = `No scan config found at ${buildOutcome.configPath}.`;
      break;
    case 'invalid-scan-config':
      message = `Invalid scan config at ${buildOutcome.configPath}: ${buildOutcome.error}`;
      break;
    case 'no-package':
      message = `No package.json found at ${buildOutcome.packagePath}.`;
      break;
    case 'invalid-package':
      message = `Invalid package.json at ${buildOutcome.packagePath}: ${buildOutcome.error}`;
      break;
    case 'invalid-manifest':
      message = `Manifest validation failed: ${buildOutcome.error}`;
      break;
  }
  return message;
}

function emptyReport(componentDir: string, indexesRelative: string, warning: string): ValidateAppReport {
  return {
    componentDir,
    indexesFile: indexesRelative,
    indexesFileExists: false,
    drift: true,
    diff: {
      added: [],
      removed: [],
      unchanged: [],
      fieldOverridesAdded: [],
      fieldOverridesRemoved: [],
      fieldOverridesUnchanged: []
    },
    generatedComposites: 0,
    generatedFieldOverrides: 0,
    existingComposites: 0,
    existingFieldOverrides: 0,
    errors: [],
    warnings: [warning]
  };
}

function formatBuildWarning(warning: ModelFirebaseIndexBuildWarning): string {
  if (warning.stage === 'extract') {
    const w = warning.warning;
    switch (w.kind) {
      case 'missing-name':
        return `(anonymous) (${w.filePath}:${w.line}) tagged export has no resolvable name`;
      case 'missing-model-tag':
        return `${w.name} (${w.filePath}:${w.line}) missing required @dbxModelFirebaseIndexModel tag`;
      case 'unresolved-model':
        return `${w.name} (${w.filePath}:${w.line}) could not resolve model "${w.model}" to a Firestore identity`;
      case 'unsupported-scope':
        return `${w.name} (${w.filePath}:${w.line}) unsupported @dbxModelFirebaseIndexScope value "${w.scope}"`;
      case 'duplicate-slug':
        return `${w.name} (${w.filePath}:${w.line}) duplicate slug "${w.slug}" — already used by ${w.previousName}`;
      case 'unknown-helper':
        return `${w.name} (${w.filePath}:${w.line}) unknown constraint helper "${w.helper}"`;
      case 'unresolved-field':
        return `${w.name} (${w.filePath}:${w.line}) could not resolve field-path argument to "${w.callee}"`;
      case 'missing-paths':
        return `${w.name} (${w.filePath}:${w.line}) has conditional constraints on [${w.conditionalFields.join(', ')}] but no \`@dbxModelFirebaseIndexPath\` declarations — add one path tag per call pattern (e.g. \`@dbxModelFirebaseIndexPath ${w.conditionalFields.join(', ')}\`)`;
      case 'unknown-path-field':
        return `${w.name} (${w.filePath}:${w.line}) \`@dbxModelFirebaseIndexPath\` references field "${w.field}" which no where/orderBy/helper call in the body produces`;
      case 'unannotated-query-helper':
        return `${w.name} (${w.filePath}:${w.line}) calls ${w.callee} (${w.calleeFilePath}:${w.calleeLine}) which returns FirestoreQueryConstraint(s) but is not tagged with @dbxModelFirebaseIndex — tag the callee or mark it @dbxModelFirebaseIndexSkip if it should be excluded.`;
      case 'transitive-cycle':
        return `${w.name} (${w.filePath}:${w.line}) transitive call to ${w.callee} would re-enter a factory already on the resolution stack — skipped to avoid infinite recursion`;
      case 'unresolvable-transitive-callee':
        return `${w.name} (${w.filePath}:${w.line}) could not locate the source for transitive callee ${w.callee} (likely a cross-package .d.ts import) — splice skipped`;
      case 'complex-query-body':
        return [
          `${w.name} (${w.filePath}:${w.line}) tagged query body contains a \`${w.branchKind}\` construct.`,
          `Tagged @dbxModelFirebaseIndex functions must be branch-free (no if/else, switch, ternary, or loops) so each maps to exactly one Firestore index.`,
          `Fix: Either (a) split this function into one tagged factory per target index — each branch becomes its own function with a static constraint shape — or (b) if this function only routes to other per-index functions, mark it \`@dbxModelFirebaseIndexDispatcher\` and have each branch \`return <perIndexFn>(...)\` instead of building constraints inline.`,
          `Run \`dbx_mcp_tool dbx_model_firebase_index_validate_app\` for the full dispatcher pattern in the tool description.`
        ].join(' ');
      case 'non-delegating-dispatcher':
        return [
          `${w.name} (${w.filePath}:${w.line}) is tagged \`@dbxModelFirebaseIndexDispatcher\` but calls \`${w.callee}\` directly.`,
          `Dispatchers must only delegate to other tagged query functions (via \`return <perIndexQuery>(...)\` in each branch) and may not call \`where\`, \`orderBy\`, or any constraint helper themselves.`,
          `Fix: Move the \`${w.callee}\` call into a sibling \`@dbxModelFirebaseIndex\`-tagged function (e.g. \`${w.name}_<variant>Query\`), then have this dispatcher \`return\` that function. If this function shouldn't be a dispatcher, remove the \`@dbxModelFirebaseIndexDispatcher\` tag instead — it will then validate as a regular branch-free query.`
        ].join(' ');
    }
  }
  const w = warning.warning;
  switch (w.kind) {
    case 'multiple-range-fields':
      return `${w.factoryName} multiple range-field constraints on [${w.fields.join(', ')}] — Firestore allows only one range field per query`;
    case 'orderby-conflict':
      return `${w.factoryName} field "${w.field}" has conflicting orderBy directions [${w.directions.join(', ')}]`;
    case 'unsupported-array-contains-any':
      return `${w.factoryName} field "${w.field}" uses array-contains-any — index support is partial`;
  }
}

// MARK: Formatting
function formatReportAsMarkdown(report: ValidateAppReport): string {
  const lines: string[] = [];
  lines.push(`# Firebase indexes validation: \`${report.componentDir}\``, '');
  if (!report.indexesFileExists) {
    lines.push(`> \`${report.indexesFile}\` does not exist. Run \`dbx-components-mcp generate-firestore-indexes --component ${report.componentDir}\` to create it.`, '');
  } else {
    lines.push(`Indexes file: \`${report.indexesFile}\``, '');
  }
  if (report.drift) {
    lines.push('## ❌ Drift detected', '');
  } else {
    lines.push('## ✅ In sync', '');
  }
  lines.push(`- generated composites: ${report.generatedComposites}`, `- existing composites: ${report.existingComposites}`, `- generated fieldOverrides: ${report.generatedFieldOverrides}`, `- existing fieldOverrides: ${report.existingFieldOverrides}`, '');

  appendDiffSection(lines, 'Composite indexes added (required, missing from JSON)', report.diff.added);
  appendDiffSection(lines, 'Composite indexes removed (in JSON, no factory requires it)', report.diff.removed);
  appendDiffSection(lines, 'fieldOverrides added (required, missing from JSON)', report.diff.fieldOverridesAdded);
  appendDiffSection(lines, 'fieldOverrides removed (in JSON, no factory requires it)', report.diff.fieldOverridesRemoved);

  if (report.errors.length > 0) {
    lines.push('## Errors', '');
    for (const error of report.errors) {
      lines.push(`- ${error}`);
    }
    lines.push('');
  }
  if (report.warnings.length > 0) {
    lines.push('## Warnings', '');
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function appendDiffSection(lines: string[], heading: string, items: readonly string[]): void {
  if (items.length === 0) return;
  lines.push(`### ${heading} (${items.length})`, '');
  for (const item of items) {
    lines.push(`- \`${item}\``);
  }
  lines.push('');
}

function formatReportAsJson(report: ValidateAppReport): string {
  return JSON.stringify(report, null, 2);
}

// Re-export for tests / external consumers.
export type { ValidateAppReport };
