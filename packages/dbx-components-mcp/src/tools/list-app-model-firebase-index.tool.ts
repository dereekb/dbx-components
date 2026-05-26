/**
 * `dbx_model_firebase_index_list_app` tool.
 *
 * Walks a downstream `-firebase` component for every `*.query.ts` factory
 * the model-firebase-index extractor recognises — tagged or untagged —
 * and emits a per-collection report:
 *
 *   - tagged factories with their derived composite-index + fieldOverride
 *     contributions (resolved against the same identity + helper registries
 *     the build-manifest CLI uses);
 *   - untagged exported functions whose return type is
 *     `FirestoreQueryConstraint[]` (candidates the author should consider
 *     tagging — they'd be invisible to the validator otherwise).
 *
 * Always runs a fresh extraction off disk so the report mirrors current
 * source state, not whatever is in the on-disk manifest.
 *
 * Mirrors the `componentDir` shape used by the other `*_list_app` tools so
 * agents can hand the same directory to multiple validators.
 */

import { resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { type FunctionDeclaration, type Project, type SourceFile } from 'ts-morph';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { buildModelFirebaseIndexManifest, formatModelFirebaseIndexBuildWarning, MODEL_FIREBASE_INDEX_SCAN_CONFIG_FILENAME, type BuildModelFirebaseIndexManifestOutcome, type DerivedComposite, type DerivedFieldOverride, type ModelFirebaseIndexEntry } from '@dereekb/dbx-cli/firestore-indexes';
import { buildScanProject, defaultGlobber, defaultReadFile, scanFactoryReferences, WORKSPACE_FACTORY_SCAN_EXCLUDE, WORKSPACE_FACTORY_SCAN_INCLUDE, type FactoryReferenceCount, type FactoryReferenceSite, buildDispatcherCreditByName, type DispatcherCredit } from '@dereekb/dbx-cli';

// MARK: Args
const ListAppArgsType = type({
  componentDir: 'string',
  'format?': "'markdown' | 'json'",
  'model?': 'string',
  'category?': 'string',
  'tag?': 'string',
  'excludedOnly?': 'boolean',
  'unusedOnly?': 'boolean',
  'includeUntagged?': 'boolean'
});

// MARK: Tool definition
const DBX_MODEL_FIREBASE_INDEX_LIST_APP_TOOL: Tool = {
  name: 'dbx_model_firebase_index_list_app',
  description: [
    'List every `*.query.ts` factory in a downstream `-firebase` component, grouped by collection.',
    '',
    'For each tagged factory the report shows the resolved model + scope, its constraint sequence, and the composite-index / `fieldOverrides[]` entries the factory contributes to `firestore.indexes.json`.',
    '',
    'For each *untagged* exported function whose return type is `FirestoreQueryConstraint[]` the report surfaces it as a candidate that should likely opt in via `@dbxModelFirebaseIndex` (or `@dbxModelFirebaseIndexSkip` to record that it was considered).',
    '',
    'Each tagged entry also carries `specOnly` (true when `@dbxModelFirebaseIndexSpecFilesOnly` opts the factory into test-only callers), `excluded` (true when `@dbxModelFirebaseIndexExclude` suppresses index emission), `referenceCount` / `productionReferenceCount` / `specReferenceCount` (workspace-wide call-site counts split by whether the consumer is a `*.spec.ts` file — the scan covers `apps/`, `components/`, and `packages/`), and `referencedBy` (sample call-sites with each `isSpec` flag set; paths are workspace-root relative).',
    '',
    'Provide:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/hellosubs-firebase`).',
    '- `format` (optional): `markdown` (default) or `json`.',
    '- `model` / `category` / `tag` (optional): server-side filters on tagged entries — exact model/identity match, category match, or tag-membership match (case-insensitive).',
    '- `excludedOnly` (optional, default false): keep only tagged entries carrying `@dbxModelFirebaseIndexExclude`.',
    '- `unusedOnly` (optional, default false): keep only tagged entries with zero production callers anywhere in the workspace (and, for `@dbxModelFirebaseIndexSpecFilesOnly` factories, zero spec callers too — spec-only factories with at least one spec caller are intentionally retained). `manual` / `skip` factories are always excluded from this filter.',
    '- `includeUntagged` (optional, default true): set to `false` to omit the untagged-candidate section.',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: { type: 'string', description: 'Relative path to the `-firebase` component package.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' },
      model: { type: 'string', description: 'Filter tagged entries to those whose model identity or name matches exactly (case-sensitive).' },
      category: { type: 'string', description: 'Filter tagged entries to those whose @dbxModelFirebaseIndexCategory matches (case-sensitive).' },
      tag: { type: 'string', description: 'Filter tagged entries to those whose `tags[]` includes the supplied value (case-insensitive).' },
      excludedOnly: { type: 'boolean', description: 'Keep only entries carrying @dbxModelFirebaseIndexExclude.' },
      unusedOnly: { type: 'boolean', description: 'Keep only entries with zero external references (skip / manual factories are still excluded).' },
      includeUntagged: { type: 'boolean', description: 'Set to false to omit the untagged-candidates section. Defaults to true.' }
    },
    required: ['componentDir']
  }
};

// MARK: Report shapes
interface TaggedFactoryUsage {
  readonly slug: string;
  readonly name: string;
  readonly subpath: string;
  readonly model: string;
  readonly collection: string;
  readonly scope: 'COLLECTION' | 'COLLECTION_GROUP';
  readonly isNested: boolean;
  readonly skip: boolean;
  readonly manual: boolean;
  /**
   * True when the factory carries `@dbxModelFirebaseIndexSpecFilesOnly`. Composites + fieldOverrides are intentionally suppressed (mirroring `skip`), and the validator raises `MODEL_FIREBASE_INDEX_SPEC_FILES_ONLY_VIOLATION` (error) if any non-spec file references the factory by name.
   */
  readonly specOnly: boolean;
  /**
   * True when the factory carries `@dbxModelFirebaseIndexExclude`. Composites + fieldOverrides are intentionally suppressed; the validator surfaces an auditable `MODEL_FIREBASE_INDEX_EXCLUDED` warning per scan.
   */
  readonly excluded: boolean;
  readonly category: string;
  readonly tags: readonly string[];
  /**
   * Total workspace-wide caller count for the factory. Scans every `.ts` file under `apps/`, `components/`, and `packages/` (excluding `*.d.ts`, `node_modules/`, and build outputs) and counts word-boundary occurrences of the factory name. The factory's own declaration file is skipped so self-references in the body don't inflate the count. Equals `productionReferenceCount + specReferenceCount`.
   */
  readonly referenceCount: number;
  /**
   * Caller count restricted to non-spec files (anything not ending in `.spec.ts` / `.spec.tsx`). Zero production callers ⇒ `MODEL_FIREBASE_INDEX_UNUSED_FACTORY` candidate when the factory is not `@dbxModelFirebaseIndexSpecFilesOnly`.
   */
  readonly productionReferenceCount: number;
  /**
   * Caller count restricted to `*.spec.ts` / `*.spec.tsx` files. For `@dbxModelFirebaseIndexSpecFilesOnly` factories this is the expected location of every caller; for other factories spec-only references still count as "unused" since they imply a production caller is missing.
   */
  readonly specReferenceCount: number;
  /**
   * Sample call-sites for the factory. Each `file` is workspace-root-relative (e.g. `apps/hellosubs-api/src/lib/.../foo.ts`) and `line` is the 1-based line of the textual reference. Capped to keep payloads bounded; the precise reference count lives in `referenceCount`.
   */
  readonly referencedBy: readonly FactoryReferenceSite[];
  /**
   * Caller count routed through any tagged `@dbxModelFirebaseIndexDispatcher` whose body delegates to this factory by name. Summed when multiple dispatchers delegate to the same factory. Counts the dispatcher's *production* (non-spec) caller references. Added to `productionReferenceCount` when determining the unused-factory warning so dispatcher-only primitives don't false-positive.
   */
  readonly dispatcherCreditedProductionCount: number;
  /**
   * Spec-only counterpart of {@link dispatcherCreditedProductionCount}. Counts the spec callers of any tagged `@dbxModelFirebaseIndexDispatcher` that delegates to this factory by name. Added to `specReferenceCount` for the unused-factory check on `@dbxModelFirebaseIndexSpecFilesOnly` entries.
   */
  readonly dispatcherCreditedSpecCount: number;
  readonly composites: readonly DerivedComposite[];
  readonly fieldOverrides: readonly DerivedFieldOverride[];
}

interface UntaggedCandidate {
  readonly name: string;
  readonly subpath: string;
  readonly line: number;
}

interface ListAppFilters {
  readonly model: string | undefined;
  readonly category: string | undefined;
  readonly tag: string | undefined;
  readonly excludedOnly: boolean;
  readonly unusedOnly: boolean;
  readonly includeUntagged: boolean;
}

interface ListAppReport {
  readonly componentDir: string;
  readonly source: string;
  readonly module: string;
  readonly tagged: readonly TaggedFactoryUsage[];
  readonly untagged: readonly UntaggedCandidate[];
  readonly compositeCount: number;
  readonly fieldOverrideCount: number;
  readonly unusedCount: number;
  readonly excludedCount: number;
  readonly specOnlyCount: number;
  readonly specOnlyViolationCount: number;
  readonly filters: ListAppFilters;
  readonly warnings: readonly string[];
}

// MARK: Tool factory
async function runListAppModelFirebaseIndex(rawArgs: unknown): Promise<ToolResult> {
  const parsed = ListAppArgsType(rawArgs);
  let result: ToolResult;
  if (parsed instanceof type.errors) {
    result = toolError(`Invalid arguments: ${parsed.summary}`);
  } else {
    const cwd = process.cwd();
    let pathError: string | undefined;
    try {
      ensurePathInsideCwd(parsed.componentDir, cwd);
    } catch (err) {
      pathError = err instanceof Error ? err.message : String(err);
    }

    if (pathError === undefined) {
      const componentAbs = resolve(cwd, parsed.componentDir);

      const filters: ListAppFilters = {
        model: parsed.model,
        category: parsed.category,
        tag: parsed.tag,
        excludedOnly: parsed.excludedOnly ?? false,
        unusedOnly: parsed.unusedOnly ?? false,
        includeUntagged: parsed.includeUntagged ?? true
      };

      let report: ListAppReport | undefined;
      let buildError: string | undefined;
      try {
        report = await buildListAppReport({ componentDir: parsed.componentDir, componentAbs, workspaceRoot: cwd, filters });
      } catch (err) {
        buildError = `Failed to walk component for firebase indexes: ${err instanceof Error ? err.message : String(err)}`;
      }

      if (buildError === undefined) {
        const text = parsed.format === 'json' ? formatReportAsJson(report as ListAppReport) : formatReportAsMarkdown(report as ListAppReport);
        result = { content: [{ type: 'text', text }] };
      } else {
        result = toolError(buildError);
      }
    } else {
      result = toolError(pathError);
    }
  }
  return result;
}

/**
 * Builds the `dbx_model_firebase_index_list_app` tool.
 *
 * @returns A registered {@link DbxTool} ready to add to the dispatch table.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createListAppModelFirebaseIndexTool(): DbxTool {
  return { definition: DBX_MODEL_FIREBASE_INDEX_LIST_APP_TOOL, run: runListAppModelFirebaseIndex };
}

// MARK: Walking
interface BuildListAppReportInput {
  readonly componentDir: string;
  readonly componentAbs: string;
  readonly workspaceRoot: string;
  readonly filters: ListAppFilters;
}

async function buildListAppReport(input: BuildListAppReportInput): Promise<ListAppReport> {
  const { componentDir, componentAbs, workspaceRoot, filters } = input;
  const buildOutcome = await buildModelFirebaseIndexManifest({
    projectRoot: componentAbs,
    generator: 'dbx_model_firebase_index_list_app'
  });

  return resolveBuildOutcome({ buildOutcome, componentDir, componentAbs, workspaceRoot, filters });
}

interface ResolveBuildOutcomeInput {
  readonly buildOutcome: BuildModelFirebaseIndexManifestOutcome;
  readonly componentDir: string;
  readonly componentAbs: string;
  readonly workspaceRoot: string;
  readonly filters: ListAppFilters;
}

async function resolveBuildOutcome(input: ResolveBuildOutcomeInput): Promise<ListAppReport> {
  const { buildOutcome, componentDir, componentAbs, workspaceRoot, filters } = input;

  let report: ListAppReport;
  switch (buildOutcome.kind) {
    case 'success': {
      const references = await scanFactoryReferences({
        projectRoot: workspaceRoot,
        entries: buildOutcome.manifest.entries.map((e) => ({ slug: e.slug, name: e.name, filePath: buildOutcome.entryFilePathsBySlug.get(e.slug) ?? '' })),
        include: WORKSPACE_FACTORY_SCAN_INCLUDE,
        exclude: WORKSPACE_FACTORY_SCAN_EXCLUDE
      });
      const dispatcherCreditByName = buildDispatcherCreditByName(buildOutcome.dispatcherSummaries, references);
      const taggedAll = buildOutcome.manifest.entries.map((entry) => toTaggedFactoryUsage(entry, references.get(entry.slug), dispatcherCreditByName.get(entry.name)));
      const tagged = applyTaggedFilters(taggedAll, filters);
      const untagged = filters.includeUntagged ? await collectUntaggedCandidates({ componentAbs, tagged: buildOutcome.manifest.entries }) : [];
      const compositeCount = tagged.reduce((acc, t) => acc + t.composites.length, 0);
      const fieldOverrideCount = tagged.reduce((acc, t) => acc + t.fieldOverrides.length, 0);
      const unusedCount = tagged.filter((t) => isUnused(t)).length;
      const excludedCount = tagged.filter((t) => t.excluded).length;
      const specOnlyCount = tagged.filter((t) => t.specOnly).length;
      const specOnlyViolationCount = tagged.filter((t) => isSpecOnlyViolation(t)).length;
      const warnings = buildOutcome.extractWarnings.map(formatModelFirebaseIndexBuildWarning);
      report = {
        componentDir,
        source: buildOutcome.manifest.source,
        module: buildOutcome.manifest.module,
        tagged,
        untagged,
        compositeCount,
        fieldOverrideCount,
        unusedCount,
        excludedCount,
        specOnlyCount,
        specOnlyViolationCount,
        filters,
        warnings
      };
      break;
    }
    case 'no-config':
      report = emptyReport(componentDir, `No \`${MODEL_FIREBASE_INDEX_SCAN_CONFIG_FILENAME}\` found at ${buildOutcome.configPath}.`, filters);
      break;
    case 'invalid-scan-config':
      report = emptyReport(componentDir, `Invalid scan config at ${buildOutcome.configPath}: ${buildOutcome.error}`, filters);
      break;
    case 'no-package':
      report = emptyReport(componentDir, `No \`package.json\` found at ${buildOutcome.packagePath}.`, filters);
      break;
    case 'invalid-package':
      report = emptyReport(componentDir, `Invalid package.json at ${buildOutcome.packagePath}: ${buildOutcome.error}`, filters);
      break;
    case 'invalid-manifest':
      report = emptyReport(componentDir, `Manifest validation failed: ${buildOutcome.error}`, filters);
      break;
  }
  return report;
}

function emptyReport(componentDir: string, warning: string, filters: ListAppFilters): ListAppReport {
  return {
    componentDir,
    source: '',
    module: '',
    tagged: [],
    untagged: [],
    compositeCount: 0,
    fieldOverrideCount: 0,
    unusedCount: 0,
    excludedCount: 0,
    specOnlyCount: 0,
    specOnlyViolationCount: 0,
    filters,
    warnings: [warning]
  };
}

/**
 * Tagged factory is "unused" when the author has not opted out via
 * `skip`/`manual` AND there are no production callers (and, for
 * `@dbxModelFirebaseIndexSpecFilesOnly` factories, no spec callers
 * either — spec-only with at least one spec caller is the intended
 * state, not "unused"). Matches the validator's rule for emitting
 * `MODEL_FIREBASE_INDEX_UNUSED_FACTORY`.
 *
 * Caller counts include both direct references and the
 * `dispatcherCreditedProductionCount` / `dispatcherCreditedSpecCount`
 * routed through tagged `@dbxModelFirebaseIndexDispatcher` factories that
 * delegate to this entry by name.
 *
 * @param t - Usage record to test.
 * @returns True when the factory is a candidate for the unused warning.
 */
function isUnused(t: TaggedFactoryUsage): boolean {
  if (t.skip || t.manual) {
    return false;
  }
  const totalProduction = t.productionReferenceCount + t.dispatcherCreditedProductionCount;
  const totalSpec = t.specReferenceCount + t.dispatcherCreditedSpecCount;
  if (t.specOnly) {
    return totalProduction === 0 && totalSpec === 0;
  }
  return totalProduction === 0;
}

/**
 * Returns true when a `@dbxModelFirebaseIndexSpecFilesOnly` factory has
 * any non-spec callers (an error condition the validator escalates).
 *
 * @param t - Usage record to test.
 * @returns True when the spec-only contract is violated.
 */
function isSpecOnlyViolation(t: TaggedFactoryUsage): boolean {
  return t.specOnly && t.productionReferenceCount > 0;
}

function applyTaggedFilters(tagged: readonly TaggedFactoryUsage[], filters: ListAppFilters): readonly TaggedFactoryUsage[] {
  const tagLower = filters.tag?.toLowerCase();
  return tagged.filter((t) => {
    if (filters.model !== undefined && t.model !== filters.model) return false;
    if (filters.category !== undefined && t.category !== filters.category) return false;
    if (tagLower !== undefined && !t.tags.some((tag) => tag.toLowerCase() === tagLower)) return false;
    if (filters.excludedOnly && !t.excluded) return false;
    if (filters.unusedOnly && !isUnused(t)) return false;
    return true;
  });
}

const MAX_REFERENCE_SAMPLES = 10;

function toTaggedFactoryUsage(entry: ModelFirebaseIndexEntry, references: FactoryReferenceCount | undefined, dispatcherCredit: DispatcherCredit | undefined): TaggedFactoryUsage {
  const referenceCount = references?.count ?? 0;
  const productionReferenceCount = references?.productionCount ?? 0;
  const specReferenceCount = references?.specCount ?? 0;
  const referencedBy = (references?.referencedBy ?? []).slice(0, MAX_REFERENCE_SAMPLES).map((r) => ({ ...r }));
  return {
    slug: entry.slug,
    name: entry.name,
    subpath: entry.subpath,
    model: entry.model,
    collection: entry.collection,
    scope: entry.scope,
    isNested: entry.isNested,
    skip: entry.skip,
    manual: entry.manual,
    specOnly: entry.specOnly ?? false,
    excluded: entry.excluded ?? false,
    category: entry.category,
    tags: [...entry.tags],
    referenceCount,
    productionReferenceCount,
    specReferenceCount,
    referencedBy,
    dispatcherCreditedProductionCount: dispatcherCredit?.productionCount ?? 0,
    dispatcherCreditedSpecCount: dispatcherCredit?.specCount ?? 0,
    composites: entry.derivedComposites.map((c) => ({ ...c, fields: c.fields.map((f) => ({ ...f })) })),
    fieldOverrides: entry.derivedFieldOverrides.map((f) => ({ ...f, variants: f.variants.map((v) => ({ ...v })) }))
  };
}

// MARK: Untagged-candidate detection
interface CollectUntaggedCandidatesInput {
  readonly componentAbs: string;
  readonly tagged: readonly ModelFirebaseIndexEntry[];
}

async function collectUntaggedCandidates(input: CollectUntaggedCandidatesInput): Promise<readonly UntaggedCandidate[]> {
  const { componentAbs, tagged } = input;
  const taggedNames = new Set(tagged.map((t) => t.name));

  const filePaths = await defaultGlobber({
    projectRoot: componentAbs,
    include: ['src/lib/model/**/*.query.ts'],
    exclude: ['**/*.spec.ts']
  });

  const project: Project = await buildScanProject({
    projectRoot: componentAbs,
    filePaths,
    readFile: defaultReadFile
  });

  const candidates: UntaggedCandidate[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    if (!sourceFile.getFilePath().endsWith('.query.ts')) continue;
    for (const fn of sourceFile.getFunctions()) {
      const usage = extractUntaggedFunction({ sourceFile, fn, componentAbs, taggedNames });
      if (usage !== undefined) {
        candidates.push(usage);
      }
    }
  }
  candidates.sort((a, b) => a.subpath.localeCompare(b.subpath) || a.name.localeCompare(b.name));
  return candidates;
}

interface ExtractUntaggedFunctionInput {
  readonly sourceFile: SourceFile;
  readonly fn: FunctionDeclaration;
  readonly componentAbs: string;
  readonly taggedNames: ReadonlySet<string>;
}

/**
 * Returns an {@link UntaggedCandidate} when `fn` is an exported function whose
 * declared return type mentions `FirestoreQueryConstraint` and whose name is
 * not already present in `taggedNames`. Returns `undefined` otherwise — the
 * caller filters these out when assembling the candidate list.
 *
 * @param input - The source file + function declaration to inspect, plus the
 *   component root used for subpath relativisation and the tagged-name set
 *   used to skip already-classified functions.
 * @returns An untagged candidate when `fn` matches, `undefined` otherwise.
 *
 * @example
 * ```ts
 * const usage = extractUntaggedFunction({ sourceFile, fn, componentAbs, taggedNames });
 * if (usage !== undefined) {
 *   candidates.push(usage);
 * }
 * ```
 */
function extractUntaggedFunction(input: ExtractUntaggedFunctionInput): UntaggedCandidate | undefined {
  const { sourceFile, fn, componentAbs, taggedNames } = input;
  let result: UntaggedCandidate | undefined;
  if (fn.isExported()) {
    const name = fn.getName();
    if (name !== undefined && !taggedNames.has(name)) {
      const returnTypeNode = fn.getReturnTypeNode();
      const returnText = returnTypeNode?.getText() ?? '';
      if (returnText.includes('FirestoreQueryConstraint')) {
        result = {
          name,
          subpath: relativeSubpath(sourceFile.getFilePath(), componentAbs),
          line: fn.getStartLineNumber()
        };
      }
    }
  }
  return result;
}

const SRC_PREFIXES = ['/src/lib/', '/src/'];

/**
 * Converts an absolute source-file path into a stable subpath relative to the
 * project root. Strips any leading `src/lib/` or `src/` segment and the
 * trailing `.ts` extension so the output mirrors how the rest of this tool
 * displays subpaths (e.g. `model/profile/profile.query`).
 *
 * @param filePath - Absolute source-file path.
 * @param projectRoot - Absolute project root the result should be relative to.
 * @returns The project-relative subpath with `src/lib/` / `src/` stripped and
 *   the trailing `.ts` removed.
 *
 * @example
 * ```ts
 * relativeSubpath('/abs/component/src/lib/model/profile/profile.query.ts', '/abs/component');
 * // → 'model/profile/profile.query'
 * ```
 */
function relativeSubpath(filePath: string, projectRoot: string): string {
  const normalised = filePath.replaceAll('\\', '/');
  const projectNormalised = projectRoot.replaceAll('\\', '/');
  let relativePath: string;
  if (normalised.startsWith(projectNormalised)) {
    relativePath = normalised.slice(projectNormalised.length).replace(/^\/+/, '');
  } else {
    relativePath = normalised;
  }
  for (const prefix of SRC_PREFIXES) {
    const stripped = `/${relativePath}`;
    const idx = stripped.indexOf(prefix);
    if (idx >= 0) {
      const remainder = stripped.slice(idx + prefix.length);
      return remainder.replace(/\.ts$/, '');
    }
  }
  return relativePath.replace(/\.ts$/, '');
}

// MARK: Formatting
function formatReportAsMarkdown(report: ListAppReport): string {
  const lines: string[] = [];
  appendMarkdownHeader(lines, report);

  let result: string;
  if (report.tagged.length === 0 && report.untagged.length === 0) {
    if (report.warnings.length > 0) {
      lines.push('## Warnings', '');
      for (const warning of report.warnings) {
        lines.push(`- ${warning}`);
      }
      result = lines.join('\n').trimEnd();
    } else {
      lines.push('_No `*.query.ts` factories found._');
      result = lines.join('\n').trimEnd();
    }
  } else {
    appendTaggedSections(lines, report.tagged);
    appendUntaggedSection(lines, report.untagged);
    appendWarningsSection(lines, report.warnings);
    result = lines.join('\n').trimEnd();
  }
  return result;
}

function appendMarkdownHeader(lines: string[], report: ListAppReport): void {
  lines.push(`# Firebase indexes used by \`${report.componentDir}\``, '');
  if (report.source.length > 0) {
    lines.push(`Source \`${report.source}\` · module \`${report.module}\``, '');
  }
  const specOnlySuffix = report.specOnlyViolationCount > 0 ? ` (${report.specOnlyViolationCount} violating)` : '';
  const summary = [
    `${report.tagged.length} tagged factor${report.tagged.length === 1 ? 'y' : 'ies'}`,
    `${report.untagged.length} untagged candidate${report.untagged.length === 1 ? '' : 's'}`,
    `${report.compositeCount} composite${report.compositeCount === 1 ? '' : 's'}`,
    `${report.fieldOverrideCount} fieldOverride contribution${report.fieldOverrideCount === 1 ? '' : 's'}`,
    `${report.unusedCount} unused`,
    `${report.excludedCount} excluded`,
    `${report.specOnlyCount} spec-only${specOnlySuffix}`
  ].join(' · ');
  lines.push(summary, '');
  const activeFilters = describeActiveFilters(report.filters);
  if (activeFilters.length > 0) {
    lines.push(`Filters: ${activeFilters.join(', ')}`, '');
  }
}

function describeActiveFilters(filters: ListAppFilters): readonly string[] {
  const out: string[] = [];
  if (filters.model !== undefined) out.push(`model=\`${filters.model}\``);
  if (filters.category !== undefined) out.push(`category=\`${filters.category}\``);
  if (filters.tag !== undefined) out.push(`tag=\`${filters.tag}\``);
  if (filters.excludedOnly) out.push('excludedOnly');
  if (filters.unusedOnly) out.push('unusedOnly');
  if (!filters.includeUntagged) out.push('includeUntagged=false');
  return out;
}

function groupTaggedByCollection(tagged: readonly TaggedFactoryUsage[]): readonly (readonly [string, readonly TaggedFactoryUsage[]])[] {
  const byCollection = new Map<string, TaggedFactoryUsage[]>();
  for (const t of tagged) {
    const list = byCollection.get(t.collection) ?? [];
    list.push(t);
    byCollection.set(t.collection, list);
  }
  return Array.from(byCollection.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function appendFactoryHeaderLine(lines: string[], t: TaggedFactoryUsage): void {
  const flags = [t.skip ? '`skip`' : null, t.manual ? '`manual`' : null, t.specOnly ? '`spec-only`' : null, t.excluded ? '`excluded`' : null, isUnused(t) ? '`unused`' : null, isSpecOnlyViolation(t) ? '`spec-only-violation`' : null].filter((v) => v !== null);
  const flagsText = flags.length > 0 ? `${flags.join(', ')} · ` : '';
  const categoryLabel = t.category.length > 0 ? t.category : '—';
  const refsText = t.specReferenceCount > 0 ? `${t.referenceCount} (prod ${t.productionReferenceCount}, spec ${t.specReferenceCount})` : `${t.referenceCount}`;
  lines.push(`- ${flagsText}scope \`${t.scope}\`${t.isNested ? ' (nested)' : ''} · category \`${categoryLabel}\` · refs ${refsText}`);
}

function appendFactoryComposites(lines: string[], composites: readonly DerivedComposite[]): void {
  if (composites.length === 0) return;
  lines.push(`- **composites:** ${composites.length}`);
  for (const composite of composites) {
    lines.push(`  - ${composite.queryScope} \`${composite.collectionGroup}\` [${composite.fields.map(formatCompositeField).join(', ')}]`);
  }
}

function appendFactoryFieldOverrides(lines: string[], fieldOverrides: readonly DerivedFieldOverride[]): void {
  if (fieldOverrides.length === 0) return;
  const variantCount = fieldOverrides.reduce((acc, f) => acc + f.variants.length, 0);
  lines.push(`- **fieldOverrides:** ${fieldOverrides.length} field${fieldOverrides.length === 1 ? '' : 's'} (${variantCount} variant${variantCount === 1 ? '' : 's'})`);
  for (const fieldOverride of fieldOverrides) {
    lines.push(`  - \`${fieldOverride.collectionGroup}.${fieldOverride.fieldPath}\` ${fieldOverride.variants.map(formatVariant).join(', ')}`);
  }
}

function appendFactoryEntry(lines: string[], t: TaggedFactoryUsage): void {
  lines.push(`### \`${t.slug}\` · \`${t.name}\``, `_${t.subpath}_`, '');
  appendFactoryHeaderLine(lines, t);
  appendFactoryComposites(lines, t.composites);
  appendFactoryFieldOverrides(lines, t.fieldOverrides);
  appendFactoryReferences(lines, t);
  if (t.composites.length === 0 && t.fieldOverrides.length === 0 && !t.skip && !t.excluded) {
    lines.push('- _auto-indexed by Firestore (no composite or fieldOverride required)_');
  }
  lines.push('');
}

function appendFactoryReferences(lines: string[], t: TaggedFactoryUsage): void {
  if (t.referencedBy.length === 0) return;
  const breakdown = t.specReferenceCount > 0 ? ` (prod ${t.productionReferenceCount}, spec ${t.specReferenceCount})` : '';
  lines.push(`- **referenced by:** ${t.referenceCount} site${t.referenceCount === 1 ? '' : 's'}${breakdown}`);
  for (const ref of t.referencedBy) {
    const tag = ref.isSpec ? ' _(spec)_' : '';
    lines.push(`  - \`${ref.file}:${ref.line}\`${tag}`);
  }
}

function appendTaggedSections(lines: string[], tagged: readonly TaggedFactoryUsage[]): void {
  if (tagged.length === 0) return;
  const grouped = groupTaggedByCollection(tagged);
  for (const [collection, group] of grouped) {
    lines.push(`## \`${collection}\`  *(${group[0].model})*`, '');
    for (const t of group) {
      appendFactoryEntry(lines, t);
    }
  }
}

function appendUntaggedSection(lines: string[], untagged: readonly UntaggedCandidate[]): void {
  if (untagged.length === 0) return;
  lines.push('## Untagged candidates', '', 'Exported functions returning `FirestoreQueryConstraint[]` without an `@dbxModelFirebaseIndex` block. Tag them so the validator can verify their indexes — or annotate with `@dbxModelFirebaseIndexSkip` to record that they were considered.', '', '| Function | File |', '| --- | --- |');
  for (const candidate of untagged) {
    lines.push(`| \`${candidate.name}\` | \`${candidate.subpath}:${candidate.line}\` |`);
  }
  lines.push('');
}

function appendWarningsSection(lines: string[], warnings: readonly string[]): void {
  if (warnings.length === 0) return;
  lines.push('## Warnings', '');
  for (const warning of warnings) {
    lines.push(`- ${warning}`);
  }
  lines.push('');
}

function formatCompositeField(field: { readonly fieldPath: string; readonly order?: 'ASCENDING' | 'DESCENDING'; readonly arrayConfig?: 'CONTAINS' }): string {
  let token: string;
  if (field.arrayConfig === undefined) {
    token = `${field.fieldPath} ${field.order === 'DESCENDING' ? 'DESC' : 'ASC'}`;
  } else {
    token = `${field.fieldPath} array-contains`;
  }
  return token;
}

function formatVariant(variant: { readonly queryScope: 'COLLECTION' | 'COLLECTION_GROUP'; readonly order?: 'ASCENDING' | 'DESCENDING'; readonly arrayConfig?: 'CONTAINS' }): string {
  let token: string;
  if (variant.arrayConfig === undefined) {
    token = `${variant.queryScope} ${variant.order === 'DESCENDING' ? 'DESC' : 'ASC'}`;
  } else {
    token = `${variant.queryScope} array-contains`;
  }
  return token;
}

function formatReportAsJson(report: ListAppReport): string {
  return JSON.stringify(report, null, 2);
}

// Re-export entry types for tests / external consumers.
export type { ListAppReport, TaggedFactoryUsage, UntaggedCandidate };

// Used internally by the function-walker test to assert behaviour. Re-exported
// at the bottom so it stays out of the tool's runtime control flow.
export { extractUntaggedFunction, relativeSubpath };
