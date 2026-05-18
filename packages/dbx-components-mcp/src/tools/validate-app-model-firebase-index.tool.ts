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
 * Every diagnostic (extract warning, analyze warning, diff drift,
 * build-config failure) is emitted as a structured violation with a
 * stable code from `model-firebase-index-validate-app/codes.ts`. The
 * code feeds `dbx_explain_rule`; the canonical fix + template + see-also
 * block auto-attaches from the rule catalog so the markdown output
 * surfaces the same remediation prose as other validators.
 *
 * `firestore.indexes.json` is resolved relative to the workspace root
 * (defaults to `firestore.indexes.json` at the workspace root, the
 * canonical hellosubs layout).
 */

import type { Maybe } from '@dereekb/util';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { buildModelFirebaseIndexManifest } from '../scan/model-firebase-index-build-manifest.js';
import { scanFactoryReferences, WORKSPACE_FACTORY_SCAN_EXCLUDE, WORKSPACE_FACTORY_SCAN_INCLUDE, type FactoryReferenceCount } from '../scan/model-firebase-index-reference-scan.js';
import type { ModelFirebaseIndexEntry } from '../manifest/model-firebase-index-schema.js';
import { createModelFirebaseIndexRegistryFromEntries, toModelFirebaseIndexEntryInfo } from '../registry/model-firebase-index-runtime.js';
import { generateFirestoreIndexesJson, type FirestoreIndexesJson } from '../scan/firestore-indexes-generate.js';
import { ModelFirebaseIndexValidateAppCode } from './model-firebase-index-validate-app/codes.js';
import { buildFirebaseIndexValidateAppViolation, mapModelFirebaseIndexBuildWarning } from './model-firebase-index-validate-app/format-warnings.js';
import type { ModelFirebaseIndexValidateAppReport, ModelFirebaseIndexValidateAppViolation } from './model-firebase-index-validate-app/types.js';
import { attachRemediation } from './rule-catalog/index.js';
import { formatStatusLabel, formatViolationLine, groupViolations, type ViolationSeverity } from './validate-format.js';

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
    'Every diagnostic surfaces a stable code (e.g. `MODEL_FIREBASE_INDEX_COMPLEX_QUERY_BODY`, `MODEL_FIREBASE_INDEX_UNANNOTATED_QUERY_HELPER`, `MODEL_FIREBASE_INDEX_COMPOSITE_ADDED`). Pass any of those codes to `dbx_explain_rule` for the canonical fix, template, and see-also references — the markdown output already inlines the same block.',
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
    '- `@dbxModelFirebaseIndexPath <field>, <field>, ...` — one sequence per tag, filtered to the listed fields (preserves declared order). Use when a static body has multiple `where`/`orderBy` calls and you want to emit multiple composites from it. NOTE: as of this version the body must be branch-free; previously this tag was the escape hatch for `if`-branched bodies, but those now error with `MODEL_FIREBASE_INDEX_COMPLEX_QUERY_BODY`.',
    "- `@dbxModelFirebaseIndexSkip` — do not emit this factory's own index. Its body still contributes constraints to callers via transitive splicing.",
    '- `@dbxModelFirebaseIndexSpecFilesOnly` — factory exists for `*.spec.ts` callers only. No composite/fieldOverride emission (like `Skip`), but the validator emits the `MODEL_FIREBASE_INDEX_SPEC_FILES_ONLY_VIOLATION` **error** if any non-spec file references the factory. The `MODEL_FIREBASE_INDEX_UNUSED_FACTORY` warning is suppressed as long as at least one `*.spec.ts` caller exists.',
    '- `@dbxModelFirebaseIndexManual` — author manages this index by hand; the generator skips it but the deployed shape is treated as expected (no `removed` drift).',
    '- `@dbxModelFirebaseIndexAllowArrayContainsAny` — silences the `MODEL_FIREBASE_INDEX_UNSUPPORTED_ARRAY_CONTAINS_ANY` warning for this factory. Use when the deployed composite is known to support `array-contains-any` for the field set and the partial-support advisory is just noise. Has no effect on index generation.',
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
    "When a tagged factory `A` calls another exported function `B` that returns `FirestoreQueryConstraint` / `FirestoreQueryConstraint[]`, the extractor splices `B`'s body into `A`'s sequence at the call site. `B` must also be tagged `@dbxModelFirebaseIndex` (or marked `@dbxModelFirebaseIndexSkip` when it's a shared helper that shouldn't emit its own composite). Untagged constraint helpers raise `MODEL_FIREBASE_INDEX_UNANNOTATED_QUERY_HELPER`.",
    '',
    '## Diagnostic codes (for `dbx_explain_rule`)',
    '',
    'Errors (validation fails when any are present):',
    '- `MODEL_FIREBASE_INDEX_COMPLEX_QUERY_BODY` — tagged body uses `if` / `switch` / ternary / loop.',
    '- `MODEL_FIREBASE_INDEX_NON_DELEGATING_DISPATCHER` — `@dbxModelFirebaseIndexDispatcher` calls `where` / `orderBy` / a helper directly.',
    '- `MODEL_FIREBASE_INDEX_SPEC_FILES_ONLY_VIOLATION` — a `@dbxModelFirebaseIndexSpecFilesOnly` factory is referenced from a non-spec file.',
    '- `MODEL_FIREBASE_INDEX_COMPOSITE_ADDED`, `MODEL_FIREBASE_INDEX_FIELD_OVERRIDE_ADDED` — required by factories, missing from JSON.',
    '',
    'Warnings (advisory):',
    '- `MODEL_FIREBASE_INDEX_MISSING_PATHS` — legacy fallback for conditional fields without `@dbxModelFirebaseIndexPath`.',
    '- `MODEL_FIREBASE_INDEX_UNKNOWN_PATH_FIELD` — path tag references a field no body call produces.',
    "- `MODEL_FIREBASE_INDEX_UNANNOTATED_QUERY_HELPER` — transitive callee isn't tagged.",
    '- `MODEL_FIREBASE_INDEX_TRANSITIVE_CYCLE` — recursion in the resolution graph.',
    "- `MODEL_FIREBASE_INDEX_UNRESOLVABLE_TRANSITIVE_CALLEE` — callee's source isn't reachable.",
    '- `MODEL_FIREBASE_INDEX_UNRESOLVED_FIELD` — non-literal field-path argument.',
    '- `MODEL_FIREBASE_INDEX_MULTIPLE_RANGE_FIELDS`, `MODEL_FIREBASE_INDEX_ORDERBY_CONFLICT`, `MODEL_FIREBASE_INDEX_UNSUPPORTED_ARRAY_CONTAINS_ANY` — Firestore index-shape issues.',
    '- `MODEL_FIREBASE_INDEX_COMPOSITE_REMOVED`, `MODEL_FIREBASE_INDEX_FIELD_OVERRIDE_REMOVED` — stale entries in JSON.',
    '- `MODEL_FIREBASE_INDEX_EXCLUDED` — `@dbxModelFirebaseIndexExclude` is suppressing index emission for an audited factory.',
    '- `MODEL_FIREBASE_INDEX_UNUSED_FACTORY` — tagged factory has no production callers anywhere in the workspace (`apps/`, `components/`, `packages/`); delete it, tag it `@dbxModelFirebaseIndexSpecFilesOnly` if it is a `*.spec.ts`-only helper, or mark `@dbxModelFirebaseIndexSkip`.',
    '',
    'Pass any code to `dbx_explain_rule` for the canonical fix and template.'
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

// MARK: Tool factory
async function runValidateAppModelFirebaseIndex(rawArgs: unknown): Promise<ToolResult> {
  const parsed = ValidateAppArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  const cwd = process.cwd();
  let toolResult: ToolResult;
  let ensureError: string | undefined;
  try {
    ensurePathInsideCwd(parsed.componentDir, cwd);
    if (parsed.indexesFile !== undefined) {
      ensurePathInsideCwd(parsed.indexesFile, cwd);
    }
  } catch (err) {
    ensureError = err instanceof Error ? err.message : String(err);
  }
  if (ensureError === undefined) {
    const indexesRelative = parsed.indexesFile ?? 'firestore.indexes.json';
    const componentAbs = resolve(cwd, parsed.componentDir);
    const indexesAbs = resolve(cwd, indexesRelative);

    let report: ModelFirebaseIndexValidateAppReport | undefined;
    let buildError: string | undefined;
    try {
      report = await buildValidateAppReport({ componentDir: parsed.componentDir, componentAbs, workspaceRoot: cwd, indexesRelative, indexesAbs });
    } catch (err) {
      buildError = `Failed to validate component firebase indexes: ${err instanceof Error ? err.message : String(err)}`;
    }
    if (buildError !== undefined || report === undefined) {
      toolResult = toolError(buildError ?? 'Failed to build validation report.');
    } else {
      const text = parsed.format === 'json' ? formatReportAsJson(report) : formatReportAsMarkdown(report);
      const baseResult: ToolResult = { content: [{ type: 'text', text }] };
      toolResult = report.drift ? { ...baseResult, isError: true } : baseResult;
    }
  } else {
    toolResult = toolError(ensureError);
  }
  return toolResult;
}

/**
 * Builds the `dbx_model_firebase_index_validate_app` tool.
 *
 * @returns A registered {@link DbxTool} ready to add to the dispatch table.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createValidateAppModelFirebaseIndexTool(): DbxTool {
  return { definition: DBX_MODEL_FIREBASE_INDEX_VALIDATE_APP_TOOL, run: runValidateAppModelFirebaseIndex };
}

// MARK: Walking
interface BuildValidateAppReportInput {
  readonly componentDir: string;
  readonly componentAbs: string;
  readonly workspaceRoot: string;
  readonly indexesRelative: string;
  readonly indexesAbs: string;
}

interface ViolationBuffer {
  readonly violations: ModelFirebaseIndexValidateAppViolation[];
  errorCount: number;
  warningCount: number;
}

function newBuffer(): ViolationBuffer {
  return { violations: [], errorCount: 0, warningCount: 0 };
}

function pushViolation(buffer: ViolationBuffer, violation: ModelFirebaseIndexValidateAppViolation): void {
  buffer.violations.push(violation);
  if (violation.severity === 'error') {
    buffer.errorCount += 1;
  } else {
    buffer.warningCount += 1;
  }
}

interface PushDiffViolationInput {
  readonly buffer: ViolationBuffer;
  readonly code: ModelFirebaseIndexValidateAppCode;
  readonly severity: ViolationSeverity;
  readonly message: string;
  readonly file: string;
}

function pushDiffViolation(input: PushDiffViolationInput): void {
  const { buffer, code, severity, message, file } = input;
  pushViolation(buffer, {
    code,
    severity,
    message,
    file,
    line: undefined,
    factory: undefined,
    remediation: attachRemediation(code)
  });
}

const MAX_PRODUCTION_SAMPLES = 5;

interface PushFactoryCallerViolationsInput {
  readonly buffer: ViolationBuffer;
  readonly entry: ModelFirebaseIndexEntry;
  readonly references: ReadonlyMap<string, FactoryReferenceCount>;
  readonly filePath: string | undefined;
}

/**
 * Emits the per-factory caller-based violations: the spec-only-violation
 * error when a `@dbxModelFirebaseIndexSpecFilesOnly` factory has any
 * non-spec callers, and the unused-factory warning when a factory has
 * no production callers (and, for spec-only factories, no spec callers
 * either).
 *
 * @param input - The validator's buffer, the manifest entry, scanner refs, and the factory's source file.
 */
function pushFactoryCallerViolations(input: PushFactoryCallerViolationsInput): void {
  const { buffer, entry, references, filePath } = input;
  if (entry.skip || entry.manual) return;
  const refs = references.get(entry.slug);
  const productionCount = refs?.productionCount ?? 0;
  const specCount = refs?.specCount ?? 0;
  if (entry.specOnly === true) {
    pushSpecOnlyCallerViolations({ buffer, entry, refs, productionCount, specCount, filePath });
    return;
  }
  if (productionCount > 0) return;
  pushViolation(buffer, {
    code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_UNUSED_FACTORY,
    severity: 'warning',
    message: formatUnusedFactoryMessage(entry.name, specCount),
    file: filePath,
    line: undefined,
    factory: entry.name,
    remediation: attachRemediation(ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_UNUSED_FACTORY)
  });
}

interface PushSpecOnlyCallerViolationsInput {
  readonly buffer: ViolationBuffer;
  readonly entry: ModelFirebaseIndexEntry;
  readonly refs: FactoryReferenceCount | undefined;
  readonly productionCount: number;
  readonly specCount: number;
  readonly filePath: string | undefined;
}

function pushSpecOnlyCallerViolations(input: PushSpecOnlyCallerViolationsInput): void {
  const { buffer, entry, refs, productionCount, specCount, filePath } = input;
  if (productionCount > 0) {
    const productionSites = (refs?.referencedBy ?? []).filter((r) => !r.isSpec).slice(0, MAX_PRODUCTION_SAMPLES);
    pushViolation(buffer, {
      code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_SPEC_FILES_ONLY_VIOLATION,
      severity: 'error',
      message: formatSpecOnlyViolationMessage(entry.name, productionCount, productionSites),
      file: filePath,
      line: undefined,
      factory: entry.name,
      remediation: attachRemediation(ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_SPEC_FILES_ONLY_VIOLATION)
    });
    return;
  }
  if (specCount > 0) return;
  pushViolation(buffer, {
    code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_UNUSED_FACTORY,
    severity: 'warning',
    message: `${entry.name} is tagged \`@dbxModelFirebaseIndexSpecFilesOnly\` but has no spec callers either — delete the factory or add \`@dbxModelFirebaseIndexSkip\` if retention is intentional.`,
    file: filePath,
    line: undefined,
    factory: entry.name,
    remediation: attachRemediation(ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_UNUSED_FACTORY)
  });
}

function formatUnusedFactoryMessage(factoryName: string, specCount: number): string {
  const plural = specCount === 1 ? '' : 's';
  const specSuffix = specCount > 0 ? ` (${specCount} spec-only caller${plural} — tag \`@dbxModelFirebaseIndexSpecFilesOnly\` if test-only is intentional)` : '';
  return `${factoryName} has no production callers anywhere in the workspace (\`apps/\`, \`components/\`, \`packages/\`)${specSuffix} — delete the factory or add \`@dbxModelFirebaseIndexSkip\` if retention is intentional.`;
}

function formatSpecOnlyViolationMessage(factoryName: string, productionCount: number, productionSites: readonly { readonly file: string; readonly line: number }[]): string {
  const plural = productionCount === 1 ? '' : 's';
  const sites = productionSites.map((r) => `\`${r.file}:${r.line}\``).join(', ');
  const sampleSuffix = sites.length === 0 ? '' : ` First non-spec references: ${sites}.`;
  return `${factoryName} is tagged \`@dbxModelFirebaseIndexSpecFilesOnly\` but is referenced from ${productionCount} non-spec file${plural}.${sampleSuffix} Either move the production call into a non-spec-only factory (and emit the required composite) or drop the tag and emit the index.`;
}

async function buildValidateAppReport(input: BuildValidateAppReportInput): Promise<ModelFirebaseIndexValidateAppReport> {
  const { componentDir, componentAbs, workspaceRoot, indexesRelative, indexesAbs } = input;
  const buffer = newBuffer();

  const buildOutcome = await buildModelFirebaseIndexManifest({
    projectRoot: componentAbs,
    generator: 'dbx_model_firebase_index_validate_app'
  });

  if (buildOutcome.kind !== 'success') {
    pushViolation(buffer, {
      code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_BUILD_FAILED,
      severity: 'warning',
      message: formatBuildFailure(buildOutcome),
      file: undefined,
      line: undefined,
      factory: undefined,
      remediation: attachRemediation(ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_BUILD_FAILED)
    });
    return emptyReport({ componentDir, indexesRelative, buffer });
  }

  const { existingJson, exists: indexesFileExists, readError } = await readExistingIndexesJson(indexesAbs);
  for (const buildWarning of buildOutcome.extractWarnings) {
    pushViolation(buffer, buildFirebaseIndexValidateAppViolation(mapModelFirebaseIndexBuildWarning(buildWarning)));
  }

  const references = await scanFactoryReferences({
    projectRoot: workspaceRoot,
    entries: buildOutcome.manifest.entries.map((e) => ({ slug: e.slug, name: e.name, filePath: buildOutcome.entryFilePathsBySlug.get(e.slug) ?? '' })),
    include: WORKSPACE_FACTORY_SCAN_INCLUDE,
    exclude: WORKSPACE_FACTORY_SCAN_EXCLUDE
  });
  for (const entry of buildOutcome.manifest.entries) {
    pushFactoryCallerViolations({ buffer, entry, references, filePath: buildOutcome.entryFilePathsBySlug.get(entry.slug) });
  }
  if (readError !== undefined) {
    pushViolation(buffer, {
      code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_INDEXES_FILE_INVALID,
      severity: 'warning',
      message: `Could not read existing \`${indexesRelative}\`: ${readError}`,
      file: indexesRelative,
      line: undefined,
      factory: undefined,
      remediation: attachRemediation(ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_INDEXES_FILE_INVALID)
    });
  }

  const entries = buildOutcome.manifest.entries.map(toModelFirebaseIndexEntryInfo);
  const registry = createModelFirebaseIndexRegistryFromEntries({ entries, loadedSources: [buildOutcome.manifest.source] });
  const { json, diff } = generateFirestoreIndexesJson({ entries: registry.all, existingJson });

  for (const composite of diff.added) {
    pushDiffViolation({
      buffer,
      code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_COMPOSITE_ADDED,
      severity: 'error',
      message: `Required composite missing from \`${indexesRelative}\`: ${composite}`,
      file: indexesRelative
    });
  }
  for (const composite of diff.removed) {
    pushDiffViolation({
      buffer,
      code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_COMPOSITE_REMOVED,
      severity: 'warning',
      message: `Stale composite in \`${indexesRelative}\` (no factory requires it): ${composite}`,
      file: indexesRelative
    });
  }
  for (const fieldOverride of diff.fieldOverridesAdded) {
    pushDiffViolation({
      buffer,
      code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_FIELD_OVERRIDE_ADDED,
      severity: 'error',
      message: `Required fieldOverride missing from \`${indexesRelative}\`: ${fieldOverride}`,
      file: indexesRelative
    });
  }
  for (const fieldOverride of diff.fieldOverridesRemoved) {
    pushDiffViolation({
      buffer,
      code: ModelFirebaseIndexValidateAppCode.MODEL_FIREBASE_INDEX_FIELD_OVERRIDE_REMOVED,
      severity: 'warning',
      message: `Stale fieldOverride in \`${indexesRelative}\` (no factory requires it): ${fieldOverride}`,
      file: indexesRelative
    });
  }

  const drift = buffer.errorCount > 0 || diff.added.length > 0 || diff.removed.length > 0 || diff.fieldOverridesAdded.length > 0 || diff.fieldOverridesRemoved.length > 0;

  return {
    componentDir,
    indexesFile: indexesRelative,
    indexesFileExists,
    drift,
    diff,
    generatedComposites: json.indexes.length,
    generatedFieldOverrides: json.fieldOverrides.length,
    existingComposites: existingJson?.indexes.length ?? 0,
    existingFieldOverrides: existingJson?.fieldOverrides.length ?? 0,
    violations: buffer.violations,
    errorCount: buffer.errorCount,
    warningCount: buffer.warningCount
  };
}

async function readExistingIndexesJson(indexesAbs: string): Promise<{ readonly existingJson?: FirestoreIndexesJson; readonly exists: boolean; readonly readError?: string }> {
  let text: Maybe<string> = null;
  let readError: string | undefined;
  let missing = false;
  try {
    text = await readFile(indexesAbs, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      missing = true;
    } else {
      readError = err instanceof Error ? err.message : String(err);
    }
  }
  let result: { readonly existingJson?: FirestoreIndexesJson; readonly exists: boolean; readonly readError?: string };
  if (missing) {
    result = { exists: false };
  } else if (text === null) {
    result = { exists: false, readError };
  } else {
    let parsed: unknown;
    let parseError: string | undefined;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }
    if (parseError !== undefined) {
      result = { exists: true, readError: parseError };
    } else if (parsed === null || typeof parsed !== 'object') {
      result = { exists: true, readError: 'Top-level value is not an object.' };
    } else {
      const raw = parsed as { indexes?: unknown; fieldOverrides?: unknown };
      const indexes = Array.isArray(raw.indexes) ? (raw.indexes as FirestoreIndexesJson['indexes']) : [];
      const fieldOverrides = Array.isArray(raw.fieldOverrides) ? (raw.fieldOverrides as FirestoreIndexesJson['fieldOverrides']) : [];
      result = { exists: true, existingJson: { indexes, fieldOverrides } };
    }
  }
  return result;
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

interface EmptyReportInput {
  readonly componentDir: string;
  readonly indexesRelative: string;
  readonly buffer: ViolationBuffer;
}

function emptyReport(input: EmptyReportInput): ModelFirebaseIndexValidateAppReport {
  const { componentDir, indexesRelative, buffer } = input;
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
    violations: buffer.violations,
    errorCount: buffer.errorCount,
    warningCount: buffer.warningCount
  };
}

// MARK: Formatting
function formatReportAsMarkdown(report: ModelFirebaseIndexValidateAppReport): string {
  const lines: string[] = [];
  const status = formatStatusLabel(report.errorCount, report.warningCount);
  lines.push(`# Firebase indexes validation: \`${report.componentDir}\` — ${status}`, '');
  if (report.indexesFileExists) {
    lines.push(`Indexes file: \`${report.indexesFile}\``, '');
  } else {
    lines.push(`> \`${report.indexesFile}\` does not exist. Run \`dbx-components-mcp generate-firestore-indexes --component ${report.componentDir}\` to create it.`, '');
  }
  if (report.drift) {
    lines.push('## ❌ Drift detected', '');
  } else {
    lines.push('## ✅ In sync', '');
  }
  lines.push(`- generated composites: ${report.generatedComposites}`, `- existing composites: ${report.existingComposites}`, `- generated fieldOverrides: ${report.generatedFieldOverrides}`, `- existing fieldOverrides: ${report.existingFieldOverrides}`, `- ${report.errorCount} error(s), ${report.warningCount} warning(s)`, '');

  if (report.violations.length > 0) {
    appendViolationSection(
      lines,
      'Errors',
      report.violations.filter((v) => v.severity === 'error')
    );
    appendViolationSection(
      lines,
      'Warnings',
      report.violations.filter((v) => v.severity === 'warning')
    );
  }

  return lines.join('\n').trimEnd();
}

function appendViolationSection(lines: string[], heading: string, violations: readonly ModelFirebaseIndexValidateAppViolation[]): void {
  if (violations.length === 0) return;
  lines.push(`## ${heading} (${violations.length})`, '');
  const byCode = groupViolations(violations, (v) => v.code);
  for (const [code, codeViolations] of byCode) {
    lines.push(`### ${code} (${codeViolations.length})`, '');
    for (const v of codeViolations) {
      lines.push(formatViolationLine(v, formatLocation(v)));
    }
    lines.push('');
  }
}

function formatLocation(violation: ModelFirebaseIndexValidateAppViolation): string {
  if (violation.file === undefined) {
    return '';
  }
  const tail = violation.line === undefined ? '' : `:${violation.line}`;
  return ` _(${violation.file}${tail})_`;
}

function formatReportAsJson(report: ModelFirebaseIndexValidateAppReport): string {
  return JSON.stringify(report, null, 2);
}

// Re-export for tests / external consumers.
export type { ModelFirebaseIndexValidateAppReport, ModelFirebaseIndexValidateAppViolation };
