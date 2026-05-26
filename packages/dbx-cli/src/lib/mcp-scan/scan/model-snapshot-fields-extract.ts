/**
 * AST extraction for the `scan-model-snapshot-fields` generator.
 *
 * Walks every source file in the supplied ts-morph `Project` looking for
 * top-level exported declarations (functions, `const` variable statements)
 * tagged with the `@dbxModelSnapshotField` JSDoc marker. Each match is
 * normalised into an {@link ExtractedModelSnapshotFieldEntry} that
 * {@link buildModelSnapshotFieldsManifest} assembles into a
 * `ModelSnapshotFieldManifest` entry.
 *
 * Optional sub-tags supply overrides that can't be reliably auto-derived
 * (slug, category, tags, related slugs, skill refs, kind, optional flag).
 * Sensible defaults are computed for each from the source — kebab-case of
 * the export name, the parent folder of the source file, the export name +
 * first JSDoc paragraph tokens, the `optional` name-prefix heuristic for
 * `optionalFirestore*` variants, etc.
 *
 * Mirrors the `utils-extract.ts` shape one-to-one so the same scanner
 * mental model applies. The differences:
 *   - kind is restricted to `factory | const` (no class/function variants —
 *     a snapshot field is always either a factory call or a pre-built const)
 *   - an `optional: boolean` field is captured for the `optionalFirestore*`
 *     name-prefix family so the lookup tool can flag required vs. optional
 *     variants and the registry can cross-link them via `relatedSlugs`.
 */

import { Node, type Project } from 'ts-morph';
import type { ModelSnapshotFieldKindValue, ModelSnapshotFieldParamEntry } from '../manifest/model-snapshot-fields-schema.js';
import { splitListTagText, unwrapFenced } from '../../scan-helpers/scan-extract-utils.js';
import { buildTagSet, collectTaggedExports, deriveCategoryFromPath, extractCandidateParams, toKebabCase, walkJsDocs, type TaggedExportFunctionCandidate, type TaggedExportVariableCandidate } from './_jsdoc-tagged-export/extract-base.js';

// MARK: Tag names
const FIELD_MARKER = 'dbxModelSnapshotField';
const FIELD_SLUG_TAG = 'dbxModelSnapshotFieldSlug';
const FIELD_CATEGORY_TAG = 'dbxModelSnapshotFieldCategory';
const FIELD_TAGS_TAG = 'dbxModelSnapshotFieldTags';
const FIELD_RELATED_TAG = 'dbxModelSnapshotFieldRelated';
const FIELD_SKILL_REFS_TAG = 'dbxModelSnapshotFieldSkillRefs';
const FIELD_KIND_TAG = 'dbxModelSnapshotFieldKind';
const FIELD_OPTIONAL_TAG = 'dbxModelSnapshotFieldOptional';

// MARK: Public types
/**
 * One snapshot-field entry extracted from a source file. Mirrors
 * {@link ModelSnapshotFieldEntry} minus `module` (derived from the package
 * being scanned in build-manifest) and `subpath` (also derived in
 * build-manifest from the project root). `filePath` and `line` are kept for
 * in-process warnings and never persisted to the manifest.
 */
export interface ExtractedModelSnapshotFieldEntry {
  readonly slug: string;
  readonly name: string;
  readonly kind: ModelSnapshotFieldKindValue;
  readonly category: string;
  readonly signature: string;
  readonly description: string;
  readonly optional: boolean;
  readonly params: readonly ModelSnapshotFieldParamEntry[];
  readonly returns: string;
  readonly tags: readonly string[];
  readonly relatedSlugs?: readonly string[];
  readonly skillRefs?: readonly string[];
  readonly example: string;
  readonly deprecated?: boolean | string;
  readonly since?: string;
  readonly filePath: string;
  readonly line: number;
}

/**
 * Discriminated union of the non-fatal events the extractor emits when an
 * entry can't be assembled. Build-manifest collates these into a structured
 * warning array so missing/invalid tag combinations surface during
 * generation rather than silently dropping entries.
 */
export type ModelSnapshotFieldExtractWarning = { readonly kind: 'unsupported-kind-override'; readonly name: string; readonly override: string; readonly filePath: string; readonly line: number } | { readonly kind: 'missing-name'; readonly filePath: string; readonly line: number } | { readonly kind: 'duplicate-slug'; readonly name: string; readonly slug: string; readonly previousName: string; readonly filePath: string; readonly line: number };

/**
 * Input to {@link extractModelSnapshotFieldEntries}. The caller is
 * responsible for adding source files to `project`.
 */
export interface ExtractModelSnapshotFieldEntriesInput {
  readonly project: Project;
  /**
   * Repo-relative project root (e.g. `packages/firebase`). The extractor
   * uses this so it can drop the project prefix from the warning `filePath`
   * fields and so the build-manifest layer can compute `subpath` against a
   * stable base.
   */
  readonly projectRoot?: string;
}

/**
 * Result of {@link extractModelSnapshotFieldEntries}.
 */
export interface ExtractModelSnapshotFieldEntriesResult {
  readonly entries: readonly ExtractedModelSnapshotFieldEntry[];
  readonly warnings: readonly ModelSnapshotFieldExtractWarning[];
}

const VALID_KIND_OVERRIDES: ReadonlySet<string> = new Set(['factory', 'const']);
const TRUE_TAG_VALUES: ReadonlySet<string> = new Set(['', 'true', 'yes', 'optional']);
const FALSE_TAG_VALUES: ReadonlySet<string> = new Set(['false', 'no', 'required']);

type TaggedCandidate = TaggedExportFunctionCandidate | TaggedExportVariableCandidate;

// MARK: Entry point
/**
 * Walks the supplied project and returns every export tagged with the
 * `@dbxModelSnapshotField` JSDoc marker. Order is stable: source files in
 * the order ts-morph reports them, declarations within a file in source order.
 *
 * @param input - The ts-morph project to scan.
 * @returns The extracted entries plus any non-fatal warnings.
 */
export function extractModelSnapshotFieldEntries(input: ExtractModelSnapshotFieldEntriesInput): ExtractModelSnapshotFieldEntriesResult {
  const { project } = input;
  const entries: ExtractedModelSnapshotFieldEntry[] = [];
  const warnings: ModelSnapshotFieldExtractWarning[] = [];
  const slugProvenance = new Map<string, { readonly name: string; readonly filePath: string; readonly line: number }>();

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    // includeClasses is false (default), so the returned candidates only
    // contain `function` and `variable` kinds — narrow via the local alias.
    const candidates = collectTaggedExports(sourceFile, FIELD_MARKER) as readonly TaggedCandidate[];
    for (const candidate of candidates) {
      const built = buildEntry({ candidate, filePath });
      if (built.kind === 'ok') {
        const previous = slugProvenance.get(built.entry.slug);
        if (previous === undefined) {
          slugProvenance.set(built.entry.slug, { name: built.entry.name, filePath, line: built.entry.line });
          entries.push(built.entry);
        } else {
          warnings.push({ kind: 'duplicate-slug', name: built.entry.name, slug: built.entry.slug, previousName: previous.name, filePath, line: built.entry.line });
        }
      }
      for (const warning of built.warnings) {
        warnings.push(warning);
      }
    }
  }

  return { entries, warnings };
}

// MARK: JSDoc parsing
interface ParsedFieldTags {
  readonly summary: string;
  readonly slug?: string;
  readonly category?: string;
  readonly explicitTags: readonly string[];
  readonly relatedSlugs: readonly string[];
  readonly skillRefs: readonly string[];
  readonly kindOverride?: string;
  readonly optionalOverride?: boolean;
  readonly examples: readonly string[];
  readonly paramDescriptions: ReadonlyMap<string, string>;
  readonly returnsText?: string;
  readonly deprecated?: boolean | string;
  readonly since?: string;
}

interface MutableTagState {
  readonly summaries: string[];
  slug: string | undefined;
  category: string | undefined;
  readonly explicitTags: string[];
  readonly relatedSlugs: string[];
  readonly skillRefs: string[];
  kindOverride: string | undefined;
  optionalOverride: boolean | undefined;
  readonly examples: string[];
  readonly paramDescriptions: Map<string, string>;
  returnsText: string | undefined;
  deprecated: boolean | string | undefined;
  since: string | undefined;
}

function readJsDocTags(candidate: TaggedCandidate): ParsedFieldTags {
  const state: MutableTagState = {
    summaries: [],
    slug: undefined,
    category: undefined,
    explicitTags: [],
    relatedSlugs: [],
    skillRefs: [],
    kindOverride: undefined,
    optionalOverride: undefined,
    examples: [],
    paramDescriptions: new Map(),
    returnsText: undefined,
    deprecated: undefined,
    since: undefined
  };

  walkJsDocs(candidate.jsDocs, {
    onSummary: (summary) => state.summaries.push(summary),
    onParam: (paramName, text) => state.paramDescriptions.set(paramName, text),
    onTag: (tagName, text) => applyJsDocTag(state, tagName, text)
  });

  return {
    summary: state.summaries.join('\n\n'),
    slug: state.slug,
    category: state.category,
    explicitTags: state.explicitTags,
    relatedSlugs: state.relatedSlugs,
    skillRefs: state.skillRefs,
    kindOverride: state.kindOverride,
    optionalOverride: state.optionalOverride,
    examples: state.examples,
    paramDescriptions: state.paramDescriptions,
    returnsText: state.returnsText,
    deprecated: state.deprecated,
    since: state.since
  };
}

function applyJsDocTag(state: MutableTagState, name: string, text: string): void {
  switch (name) {
    case FIELD_MARKER:
      break;
    case FIELD_SLUG_TAG:
      state.slug = text;
      break;
    case FIELD_CATEGORY_TAG:
      state.category = text;
      break;
    case FIELD_TAGS_TAG:
      for (const tag of splitListTagText(text)) {
        state.explicitTags.push(tag.toLowerCase());
      }
      break;
    case FIELD_RELATED_TAG:
      for (const slug of splitListTagText(text)) {
        state.relatedSlugs.push(slug);
      }
      break;
    case FIELD_SKILL_REFS_TAG:
      for (const ref of splitListTagText(text)) {
        state.skillRefs.push(ref);
      }
      break;
    case FIELD_KIND_TAG:
      state.kindOverride = text;
      break;
    case FIELD_OPTIONAL_TAG:
      state.optionalOverride = parseOptionalText(text);
      break;
    case 'example':
      state.examples.push(unwrapFenced(text));
      break;
    case 'returns':
    case 'return':
      state.returnsText = text;
      break;
    case 'deprecated':
      state.deprecated = text.length > 0 ? text : true;
      break;
    case 'since':
      if (text.length > 0) {
        state.since = text;
      }
      break;
    default:
      break;
  }
}

function parseOptionalText(text: string): boolean | undefined {
  const lowered = text.trim().toLowerCase();
  let result: boolean | undefined;
  if (TRUE_TAG_VALUES.has(lowered)) {
    result = true;
  } else if (FALSE_TAG_VALUES.has(lowered)) {
    result = false;
  }
  return result;
}

// MARK: Entry construction
interface BuildEntryInput {
  readonly candidate: TaggedCandidate;
  readonly filePath: string;
}

type BuildEntryResult = { readonly kind: 'ok'; readonly entry: ExtractedModelSnapshotFieldEntry; readonly warnings: readonly ModelSnapshotFieldExtractWarning[] } | { readonly kind: 'skipped'; readonly warnings: readonly ModelSnapshotFieldExtractWarning[] };

type ResolveKindResult = { readonly ok: true; readonly kind: ModelSnapshotFieldKindValue } | { readonly ok: false; readonly warning: ModelSnapshotFieldExtractWarning };

interface ResolveKindInput {
  readonly name: string;
  readonly kindOverride: string | undefined;
  readonly defaultKind: ModelSnapshotFieldKindValue;
  readonly filePath: string;
  readonly line: number;
}

function resolveEntryKind(input: ResolveKindInput): ResolveKindResult {
  const { name, kindOverride, defaultKind, filePath, line } = input;
  let result: ResolveKindResult;
  if (kindOverride === undefined || kindOverride.length === 0) {
    result = { ok: true, kind: defaultKind };
  } else if (VALID_KIND_OVERRIDES.has(kindOverride)) {
    result = { ok: true, kind: kindOverride as ModelSnapshotFieldKindValue };
  } else {
    result = { ok: false, warning: { kind: 'unsupported-kind-override', name, override: kindOverride, filePath, line } };
  }
  return result;
}

function buildEntry(input: BuildEntryInput): BuildEntryResult {
  const { candidate, filePath } = input;
  const warnings: ModelSnapshotFieldExtractWarning[] = [];

  const meta = readCandidateMeta(candidate);
  if (meta.name === undefined || meta.name.length === 0) {
    warnings.push({ kind: 'missing-name', filePath, line: meta.line });
    return { kind: 'skipped', warnings };
  }

  const tags = readJsDocTags(candidate);
  const kindResult = resolveEntryKind({ name: meta.name, kindOverride: tags.kindOverride, defaultKind: meta.defaultKind, filePath, line: meta.line });
  if (!kindResult.ok) {
    warnings.push(kindResult.warning);
    return { kind: 'skipped', warnings };
  }
  const kind = kindResult.kind;

  const slug = tags.slug && tags.slug.length > 0 ? tags.slug : toKebabCase(meta.name);
  const category = tags.category && tags.category.length > 0 ? tags.category : deriveCategoryFromPath(filePath);
  const params = extractCandidateParams(candidate, tags.paramDescriptions);
  const returns = tags.returnsText && tags.returnsText.length > 0 ? tags.returnsText : meta.defaultReturnTypeText;
  const signature = buildSignature({ name: meta.name, kind, params, returnType: meta.defaultReturnTypeText });
  const example = tags.examples.length > 0 ? tags.examples[0] : '';
  const tagSet = buildTagSet({ name: meta.name, slug, summary: tags.summary, explicit: tags.explicitTags, category });
  const optional = tags.optionalOverride ?? deriveOptionalFromName(meta.name);

  const entry: ExtractedModelSnapshotFieldEntry = {
    slug,
    name: meta.name,
    kind,
    category,
    signature,
    description: tags.summary,
    optional,
    params,
    returns,
    tags: tagSet,
    ...(tags.relatedSlugs.length > 0 ? { relatedSlugs: tags.relatedSlugs } : {}),
    ...(tags.skillRefs.length > 0 ? { skillRefs: tags.skillRefs } : {}),
    example,
    ...(tags.deprecated === undefined ? {} : { deprecated: tags.deprecated }),
    ...(tags.since === undefined ? {} : { since: tags.since }),
    filePath,
    line: meta.line
  };

  return { kind: 'ok', entry, warnings };
}

interface CandidateMeta {
  readonly name: string | undefined;
  readonly line: number;
  readonly defaultKind: ModelSnapshotFieldKindValue;
  readonly defaultReturnTypeText: string;
}

function readCandidateMeta(candidate: TaggedCandidate): CandidateMeta {
  let result: CandidateMeta;
  if (candidate.kind === 'function') {
    const returnType = candidate.decl.getReturnTypeNode()?.getText() ?? candidate.decl.getReturnType().getText();
    result = {
      name: candidate.decl.getName(),
      line: candidate.decl.getStartLineNumber(),
      defaultKind: 'factory',
      defaultReturnTypeText: returnType
    };
  } else {
    const initializer = candidate.decl.getInitializer();
    let defaultKind: ModelSnapshotFieldKindValue = 'const';
    let returnTypeText = '';
    if (initializer !== undefined && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
      const declaredReturn = initializer.getReturnTypeNode()?.getText();
      const inferred = declaredReturn ?? initializer.getReturnType().getText();
      defaultKind = 'factory';
      returnTypeText = inferred;
    } else {
      const typeNode = candidate.decl.getTypeNode()?.getText();
      returnTypeText = typeNode ?? candidate.decl.getType().getText();
    }
    result = {
      name: candidate.decl.getName(),
      line: candidate.decl.getStartLineNumber(),
      defaultKind,
      defaultReturnTypeText: returnTypeText
    };
  }
  return result;
}

interface BuildSignatureInput {
  readonly name: string;
  readonly kind: ModelSnapshotFieldKindValue;
  readonly params: readonly ModelSnapshotFieldParamEntry[];
  readonly returnType: string;
}

function buildSignature(input: BuildSignatureInput): string {
  const { name, kind, params, returnType } = input;
  let result: string;
  if (kind === 'const') {
    result = `const ${name}: ${returnType.length > 0 ? returnType : 'unknown'}`;
  } else {
    const paramList = params.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ');
    result = `${name}(${paramList}): ${returnType.length > 0 ? returnType : 'unknown'}`;
  }
  return result;
}

// MARK: Defaults
/**
 * Heuristic that flags `optionalFirestore*` exports as optional. The user
 * can override this with `@dbxModelSnapshotFieldOptional false`.
 *
 * @param name - The export identifier.
 * @returns True when the name signals an optional variant.
 */
export function deriveOptionalFromName(name: string): boolean {
  return name.startsWith('optional') || name.startsWith('OPTIONAL_');
}
