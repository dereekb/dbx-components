/**
 * AST extraction for the `scan-model-firebase-indexes` generator.
 *
 * Walks every source file in the supplied ts-morph `Project` looking for
 * top-level exported functions tagged with the `@dbxModelFirebaseIndex`
 * JSDoc marker. For each match:
 *
 *   1. Reads JSDoc-tag metadata (model, scope, manual/skip flags, category,
 *      tags, related slugs).
 *   2. Resolves the target model's short collection name and nested flag
 *      via {@link FirestoreModelIdentityResolver}.
 *   3. Walks the function body collecting `where(...)`, `orderBy(...)`, and
 *      known-helper calls (from {@link FIRESTORE_QUERY_HELPERS}) in source
 *      order, expanding helpers into their base constraint sequences.
 *   4. Emits one {@link ExtractedModelFirebaseIndexEntry} per factory.
 *
 * Conditional-branch enumeration is opt-in via `@dbxModelFirebaseIndexPath`.
 * Each path tag declares one call pattern as a comma-separated list of
 * field paths, and the extractor produces one constraint sequence per tag
 * (filtered to the listed fields, preserving body source order). When no
 * path tag is declared, the extractor falls back to a single 'all'
 * sequence containing every constraint call in the body; if any of those
 * calls sits inside an `if`/`switch`/ternary branch, a `missing-paths`
 * warning surfaces the conditional fields so the author can declare the
 * meaningful subsets.
 *
 * Mirrors `model-snapshot-fields-extract.ts` for tag parsing + entry
 * assembly conventions.
 */

import { Node, SyntaxKind, type CallExpression, type FunctionDeclaration, type Identifier, type JSDoc, type ParameterDeclaration, type Project, type SourceFile } from 'ts-morph';
import { type ConstraintSequence, type ConstraintSequenceEntry, type FirestoreQueryScope, type FirestoreWhereOperator, type ModelFirebaseIndexParamEntry, FIRESTORE_WHERE_OPERATORS } from './model-firebase-index-schema.js';
import { type FirestoreModelIdentityResolver, type ResolvedFirestoreModelIdentity } from './firestore-model-identity-resolver.js';
import { expandFirestoreQueryHelper, getFirestoreQueryHelperDescriptor } from './firestore-query-helpers.js';
import { splitListTagText, unwrapFenced } from '../../src/lib/scan-helpers/scan-extract-utils.js';

// MARK: Tag names
const INDEX_MARKER = 'dbxModelFirebaseIndex';
const INDEX_DISPATCHER_TAG = 'dbxModelFirebaseIndexDispatcher';
const INDEX_MODEL_TAG = 'dbxModelFirebaseIndexModel';
const INDEX_SCOPE_TAG = 'dbxModelFirebaseIndexScope';
const INDEX_MANUAL_TAG = 'dbxModelFirebaseIndexManual';
const INDEX_SKIP_TAG = 'dbxModelFirebaseIndexSkip';
const INDEX_SPEC_FILES_ONLY_TAG = 'dbxModelFirebaseIndexSpecFilesOnly';
const INDEX_EXCLUDE_TAG = 'dbxModelFirebaseIndexExclude';
const INDEX_ALLOW_ARRAY_CONTAINS_ANY_TAG = 'dbxModelFirebaseIndexAllowArrayContainsAny';
const INDEX_CATEGORY_TAG = 'dbxModelFirebaseIndexCategory';
const INDEX_TAGS_TAG = 'dbxModelFirebaseIndexTags';
const INDEX_RELATED_TAG = 'dbxModelFirebaseIndexRelated';
const INDEX_SKILL_REFS_TAG = 'dbxModelFirebaseIndexSkillRefs';
const INDEX_SLUG_TAG = 'dbxModelFirebaseIndexSlug';
const INDEX_PATH_TAG = 'dbxModelFirebaseIndexPath';

/**
 * SyntaxKind values that disqualify a tagged query function from the
 * "one factory per target index, no branching" convention. Each tagged
 * non-dispatcher factory whose body contains any of these emits a
 * `complex-query-body` error and skips constraint extraction.
 */
const COMPLEX_BODY_SYNTAX_KINDS: ReadonlyMap<SyntaxKind, ComplexQueryBranchKind> = new Map<SyntaxKind, ComplexQueryBranchKind>([
  [SyntaxKind.IfStatement, 'if'],
  [SyntaxKind.SwitchStatement, 'switch'],
  [SyntaxKind.ConditionalExpression, 'ternary'],
  [SyntaxKind.ForStatement, 'loop'],
  [SyntaxKind.ForOfStatement, 'loop'],
  [SyntaxKind.ForInStatement, 'loop'],
  [SyntaxKind.WhileStatement, 'loop'],
  [SyntaxKind.DoStatement, 'loop']
]);

// MARK: Public types
/**
 * One firebase-index entry extracted from a source file. Mirrors
 * {@link ModelFirebaseIndexEntry} minus `module` and `subpath` (derived in
 * build-manifest from the package being scanned and the project root).
 * `filePath` and `line` are kept for in-process warnings and never
 * persisted to the manifest.
 */
export interface ExtractedModelFirebaseIndexEntry {
  readonly slug: string;
  readonly name: string;
  readonly model: string;
  readonly collection: string;
  readonly isNested: boolean;
  readonly scope: FirestoreQueryScope;
  readonly manual: boolean;
  readonly skip: boolean;
  /**
   * True when the factory carries `@dbxModelFirebaseIndexSpecFilesOnly`. The
   * factory is intentionally for `.spec.ts` use only — the analyzer suppresses
   * composite + fieldOverride emission (mirroring `skip`), and the validator
   * raises `MODEL_FIREBASE_INDEX_SPEC_FILES_ONLY_VIOLATION` (error) if a
   * non-spec file references the factory by name.
   */
  readonly specOnly: boolean;
  /**
   * True when the factory carries `@dbxModelFirebaseIndexExclude`. The
   * constraint sequence is still parsed (unlike `skip`, which empties it)
   * so the list-app / lookup tools can display the would-be query shape;
   * the analyzer suppresses composite + fieldOverride emission. Every
   * excluded factory also produces an `excluded-factory` warning so the
   * exclusion is auditable.
   */
  readonly excluded: boolean;
  /**
   * True when the factory carries `@dbxModelFirebaseIndexDispatcher`. The
   * factory itself produces no composite/fieldOverride (its
   * `constraintSequences` is always empty), but the validator credits its
   * caller count to every name listed in `dispatcherDelegates` so a
   * dispatcher-only primitive does not perpetually false-positive on
   * `MODEL_FIREBASE_INDEX_UNUSED_FACTORY`.
   */
  readonly dispatcher: boolean;
  /**
   * Identifier-callee names captured from the body of a dispatcher-tagged
   * factory. Populated only when `dispatcher` is true; empty otherwise.
   * Names are reported as written in source (no resolution to slugs) — the
   * validator matches them against other tagged factories' `name` fields
   * when crediting unused-factory references.
   */
  readonly dispatcherDelegates: readonly string[];
  readonly allowArrayContainsAny: boolean;
  readonly category: string;
  readonly signature: string;
  readonly description: string;
  readonly params: readonly ModelFirebaseIndexParamEntry[];
  readonly returns: string;
  readonly tags: readonly string[];
  readonly relatedSlugs?: readonly string[];
  readonly skillRefs?: readonly string[];
  readonly example: string;
  readonly constraintSequences: readonly ConstraintSequence[];
  readonly deprecated?: boolean | string;
  readonly since?: string;
  readonly filePath: string;
  readonly line: number;
}

/**
 * Discriminated union of the non-fatal events the extractor emits when an
 * entry can't be assembled cleanly.
 */
export type ModelFirebaseIndexExtractWarningSeverity = 'error' | 'warning';

/**
 * The branch construct that disqualified a tagged query factory's body.
 */
export type ComplexQueryBranchKind = 'if' | 'switch' | 'ternary' | 'loop';

export type ModelFirebaseIndexExtractWarning =
  | { readonly kind: 'missing-name'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly filePath: string; readonly line: number }
  | { readonly kind: 'missing-model-tag'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly name: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unresolved-model'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly name: string; readonly model: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unsupported-scope'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly name: string; readonly scope: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'duplicate-slug'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly name: string; readonly slug: string; readonly previousName: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unknown-helper'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly name: string; readonly helper: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unresolved-field'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly name: string; readonly callee: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'missing-paths'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly name: string; readonly conditionalFields: readonly string[]; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unknown-path-field'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly name: string; readonly field: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unannotated-query-helper'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly name: string; readonly callee: string; readonly calleeFilePath: string; readonly calleeLine: number; readonly filePath: string; readonly line: number }
  | { readonly kind: 'transitive-cycle'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly name: string; readonly callee: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unresolvable-transitive-callee'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly name: string; readonly callee: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'complex-query-body'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly name: string; readonly branchKind: ComplexQueryBranchKind; readonly filePath: string; readonly line: number }
  | { readonly kind: 'non-delegating-dispatcher'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly name: string; readonly callee: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'excluded-factory'; readonly severity: ModelFirebaseIndexExtractWarningSeverity; readonly name: string; readonly filePath: string; readonly line: number };

/**
 * Input to {@link extractModelFirebaseIndexEntries}.
 */
export interface ExtractModelFirebaseIndexEntriesInput {
  readonly project: Project;
  readonly identityResolver: FirestoreModelIdentityResolver;
  readonly projectRoot?: string;
}

/**
 * Result of {@link extractModelFirebaseIndexEntries}.
 */
export interface ExtractModelFirebaseIndexEntriesResult {
  readonly entries: readonly ExtractedModelFirebaseIndexEntry[];
  readonly warnings: readonly ModelFirebaseIndexExtractWarning[];
}

const VALID_SCOPE_TAG_VALUES: ReadonlySet<string> = new Set(['COLLECTION', 'COLLECTION_GROUP']);
const TRUE_TAG_VALUES: ReadonlySet<string> = new Set(['', 'true', 'yes']);
const FALSE_TAG_VALUES: ReadonlySet<string> = new Set(['false', 'no']);
const WHERE_OPERATOR_SET: ReadonlySet<string> = new Set(FIRESTORE_WHERE_OPERATORS);

// MARK: Entry point
/**
 * Walks the supplied project and returns every export tagged with the
 * `@dbxModelFirebaseIndex` JSDoc marker. Order is stable: source files in
 * the order ts-morph reports them, declarations within a file in source
 * order.
 *
 * @param input - The ts-morph project, identity resolver, and project root.
 * @returns The extracted entries plus any non-fatal warnings.
 */
export function extractModelFirebaseIndexEntries(input: ExtractModelFirebaseIndexEntriesInput): ExtractModelFirebaseIndexEntriesResult {
  const { project, identityResolver } = input;
  const entries: ExtractedModelFirebaseIndexEntry[] = [];
  const warnings: ModelFirebaseIndexExtractWarning[] = [];
  const slugProvenance = new Map<string, { readonly name: string; readonly filePath: string; readonly line: number }>();

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const candidates = collectTaggedFunctions(sourceFile);
    for (const candidate of candidates) {
      const built = buildEntry({ candidate, filePath, identityResolver });
      if (built.kind === 'ok') {
        const previous = slugProvenance.get(built.entry.slug);
        if (previous === undefined) {
          slugProvenance.set(built.entry.slug, { name: built.entry.name, filePath, line: built.entry.line });
          entries.push(built.entry);
        } else {
          warnings.push({ kind: 'duplicate-slug', severity: 'warning', name: built.entry.name, slug: built.entry.slug, previousName: previous.name, filePath, line: built.entry.line });
        }
      }
      for (const warning of built.warnings) {
        warnings.push(warning);
      }
    }
  }

  return { entries, warnings };
}

// MARK: Candidate collection
interface TaggedCandidate {
  readonly decl: FunctionDeclaration;
  readonly jsDocs: readonly JSDoc[];
}

function collectTaggedFunctions(sourceFile: SourceFile): readonly TaggedCandidate[] {
  const out: TaggedCandidate[] = [];
  for (const decl of sourceFile.getFunctions()) {
    if (!decl.isExported()) {
      continue;
    }
    const jsDocs = findTaggedDocs(decl.getJsDocs());
    if (jsDocs.length > 0) {
      out.push({ decl, jsDocs });
    }
  }
  return out;
}

function findTaggedDocs(jsDocs: readonly JSDoc[]): readonly JSDoc[] {
  let hasMarker = false;
  for (const doc of jsDocs) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() === INDEX_MARKER) {
        hasMarker = true;
      }
    }
  }
  return hasMarker ? jsDocs : [];
}

// MARK: JSDoc parsing
interface ParsedIndexTags {
  readonly summary: string;
  readonly slug?: string;
  readonly model?: string;
  readonly scope?: string;
  readonly manual: boolean;
  readonly skip: boolean;
  readonly specOnly: boolean;
  readonly excluded: boolean;
  readonly dispatcher: boolean;
  readonly allowArrayContainsAny: boolean;
  readonly category?: string;
  readonly explicitTags: readonly string[];
  readonly relatedSlugs: readonly string[];
  readonly skillRefs: readonly string[];
  readonly examples: readonly string[];
  readonly paramDescriptions: ReadonlyMap<string, string>;
  readonly returnsText?: string;
  readonly deprecated?: boolean | string;
  readonly since?: string;
  /**
   * One entry per `@dbxModelFirebaseIndexPath` tag occurrence. Each entry
   * is the parsed list of field paths the author declared for that call
   * pattern. Empty when no path tag is present.
   */
  readonly paths: readonly (readonly string[])[];
}

interface MutableTagState {
  readonly summaries: string[];
  slug: string | undefined;
  model: string | undefined;
  scope: string | undefined;
  manual: boolean;
  skip: boolean;
  specOnly: boolean;
  excluded: boolean;
  dispatcher: boolean;
  allowArrayContainsAny: boolean;
  category: string | undefined;
  readonly explicitTags: string[];
  readonly relatedSlugs: string[];
  readonly skillRefs: string[];
  readonly examples: string[];
  readonly paramDescriptions: Map<string, string>;
  returnsText: string | undefined;
  deprecated: boolean | string | undefined;
  since: string | undefined;
  readonly paths: string[][];
}

function readJsDocTags(jsDocs: readonly JSDoc[]): ParsedIndexTags {
  const state: MutableTagState = {
    summaries: [],
    slug: undefined,
    model: undefined,
    scope: undefined,
    manual: false,
    skip: false,
    specOnly: false,
    excluded: false,
    dispatcher: false,
    allowArrayContainsAny: false,
    category: undefined,
    explicitTags: [],
    relatedSlugs: [],
    skillRefs: [],
    examples: [],
    paramDescriptions: new Map(),
    returnsText: undefined,
    deprecated: undefined,
    since: undefined,
    paths: []
  };

  for (const jsDoc of jsDocs) {
    const description = jsDoc.getDescription().trim();
    if (description.length > 0) {
      state.summaries.push(description);
    }
    for (const tag of jsDoc.getTags()) {
      const tagName = tag.getTagName();
      const text = tag.getCommentText()?.trim() ?? '';
      if (tagName === 'param') {
        const paramName = (tag as unknown as { getName?: () => string }).getName?.() ?? extractParamName(tag.getText());
        if (paramName !== undefined && paramName.length > 0) {
          state.paramDescriptions.set(paramName, text);
        }
      } else {
        applyTag(state, tagName, text);
      }
    }
  }

  return {
    summary: state.summaries.join('\n\n'),
    slug: state.slug,
    model: state.model,
    scope: state.scope,
    manual: state.manual,
    skip: state.skip,
    specOnly: state.specOnly,
    excluded: state.excluded,
    dispatcher: state.dispatcher,
    allowArrayContainsAny: state.allowArrayContainsAny,
    category: state.category,
    explicitTags: state.explicitTags,
    relatedSlugs: state.relatedSlugs,
    skillRefs: state.skillRefs,
    examples: state.examples,
    paramDescriptions: state.paramDescriptions,
    returnsText: state.returnsText,
    deprecated: state.deprecated,
    since: state.since,
    paths: state.paths.map((p) => [...p])
  };
}

function applyTag(state: MutableTagState, name: string, text: string): void {
  switch (name) {
    case INDEX_MARKER:
      break;
    case INDEX_SLUG_TAG:
      state.slug = text;
      break;
    case INDEX_MODEL_TAG:
      state.model = text;
      break;
    case INDEX_SCOPE_TAG:
      state.scope = text;
      break;
    case INDEX_MANUAL_TAG:
      state.manual = parseBooleanTag(text) ?? true;
      break;
    case INDEX_SKIP_TAG:
      state.skip = parseBooleanTag(text) ?? true;
      break;
    case INDEX_SPEC_FILES_ONLY_TAG:
      state.specOnly = parseBooleanTag(text) ?? true;
      break;
    case INDEX_EXCLUDE_TAG:
      state.excluded = parseBooleanTag(text) ?? true;
      break;
    case INDEX_DISPATCHER_TAG:
      state.dispatcher = parseBooleanTag(text) ?? true;
      break;
    case INDEX_ALLOW_ARRAY_CONTAINS_ANY_TAG:
      state.allowArrayContainsAny = parseBooleanTag(text) ?? true;
      break;
    case INDEX_CATEGORY_TAG:
      state.category = text;
      break;
    case INDEX_TAGS_TAG:
      for (const tag of splitListTagText(text)) {
        state.explicitTags.push(tag.toLowerCase());
      }
      break;
    case INDEX_RELATED_TAG:
      for (const slug of splitListTagText(text)) {
        state.relatedSlugs.push(slug);
      }
      break;
    case INDEX_SKILL_REFS_TAG:
      for (const ref of splitListTagText(text)) {
        state.skillRefs.push(ref);
      }
      break;
    case INDEX_PATH_TAG: {
      const fields = [...splitListTagText(text)];
      if (fields.length > 0) {
        state.paths.push(fields);
      }
      break;
    }
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

function parseBooleanTag(text: string): boolean | undefined {
  const lowered = text.trim().toLowerCase();
  let result: boolean | undefined;
  if (TRUE_TAG_VALUES.has(lowered)) {
    result = true;
  } else if (FALSE_TAG_VALUES.has(lowered)) {
    result = false;
  }
  return result;
}

function extractParamName(rawTag: string): string | undefined {
  const match = /@param\s+(?:\{[^}]*\}\s+)?(\S+)/.exec(rawTag);
  return match?.[1];
}

// MARK: Entry construction
interface BuildEntryInput {
  readonly candidate: TaggedCandidate;
  readonly filePath: string;
  readonly identityResolver: FirestoreModelIdentityResolver;
}

type BuildEntryResult = { readonly kind: 'ok'; readonly entry: ExtractedModelFirebaseIndexEntry; readonly warnings: readonly ModelFirebaseIndexExtractWarning[] } | { readonly kind: 'skipped'; readonly warnings: readonly ModelFirebaseIndexExtractWarning[] };

function buildEntry(input: BuildEntryInput): BuildEntryResult {
  const { candidate, filePath, identityResolver } = input;
  const warnings: ModelFirebaseIndexExtractWarning[] = [];

  const name = candidate.decl.getName();
  const line = candidate.decl.getStartLineNumber();
  if (name === undefined || name.length === 0) {
    warnings.push({ kind: 'missing-name', severity: 'warning', filePath, line });
    return { kind: 'skipped', warnings };
  }

  const tags = readJsDocTags(candidate.jsDocs);
  const resolved = resolveIdentity({ tags, identityResolver, name, filePath, line, warnings });
  if (resolved === undefined) {
    return { kind: 'skipped', warnings };
  }

  const scope = resolveScope({ tags, resolved, name, filePath, line, warnings });
  if (scope === undefined) {
    return { kind: 'skipped', warnings };
  }

  const modelTag = tags.model as string;
  const entry = composeEntry({ candidate, tags, modelTag, resolved, scope, name, line, filePath, warnings });
  return { kind: 'ok', entry, warnings };
}

interface ResolveIdentityInput {
  readonly tags: ParsedIndexTags;
  readonly identityResolver: FirestoreModelIdentityResolver;
  readonly name: string;
  readonly filePath: string;
  readonly line: number;
  readonly warnings: ModelFirebaseIndexExtractWarning[];
}

function resolveIdentity(input: ResolveIdentityInput): ResolvedFirestoreModelIdentity | undefined {
  const { tags, identityResolver, name, filePath, line, warnings } = input;
  if (tags.model === undefined || tags.model.length === 0) {
    warnings.push({ kind: 'missing-model-tag', severity: 'warning', name, filePath, line });
    return undefined;
  }
  const resolved = identityResolver.lookupByTypeName(tags.model);
  if (resolved === undefined) {
    warnings.push({ kind: 'unresolved-model', severity: 'warning', name, model: tags.model, filePath, line });
    return undefined;
  }
  return resolved;
}

interface ComposeEntryInput {
  readonly candidate: TaggedCandidate;
  readonly tags: ParsedIndexTags;
  readonly modelTag: string;
  readonly resolved: ResolvedFirestoreModelIdentity;
  readonly scope: FirestoreQueryScope;
  readonly name: string;
  readonly line: number;
  readonly filePath: string;
  readonly warnings: ModelFirebaseIndexExtractWarning[];
}

function composeEntry(input: ComposeEntryInput): ExtractedModelFirebaseIndexEntry {
  const { candidate, tags, modelTag, resolved, scope, name, line, filePath, warnings } = input;

  const slug = tags.slug && tags.slug.length > 0 ? tags.slug : toKebabCase(name);
  const params = collectParams(candidate.decl, tags.paramDescriptions);
  const returnType = candidate.decl.getReturnTypeNode()?.getText() ?? candidate.decl.getReturnType().getText();
  const paramSignature = params.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ');
  const returnSignature = returnType.length > 0 ? returnType : 'unknown';
  const signature = `${name}(${paramSignature}): ${returnSignature}`;
  const returns = tags.returnsText && tags.returnsText.length > 0 ? tags.returnsText : returnType;
  const example = tags.examples.length > 0 ? tags.examples[0] : '';
  const category = tags.category && tags.category.length > 0 ? tags.category : 'misc';
  const tagSet = buildTagSet({ name, slug, summary: tags.summary, explicit: tags.explicitTags, category, model: modelTag });

  const { constraintSequences, dispatcherDelegates } = resolveConstraintSequences({ candidate, tags, name, line, filePath, warnings });

  if (tags.excluded) {
    warnings.push({ kind: 'excluded-factory', severity: 'warning', name, filePath, line });
  }

  return {
    slug,
    name,
    model: modelTag,
    collection: resolved.collection,
    isNested: resolved.isNested,
    scope,
    manual: tags.manual,
    skip: tags.skip,
    specOnly: tags.specOnly,
    excluded: tags.excluded,
    dispatcher: tags.dispatcher,
    dispatcherDelegates,
    allowArrayContainsAny: tags.allowArrayContainsAny,
    category,
    signature,
    description: tags.summary,
    params,
    returns,
    tags: tagSet,
    ...(tags.relatedSlugs.length > 0 ? { relatedSlugs: tags.relatedSlugs } : {}),
    ...(tags.skillRefs.length > 0 ? { skillRefs: tags.skillRefs } : {}),
    example,
    constraintSequences,
    ...(tags.deprecated === undefined ? {} : { deprecated: tags.deprecated }),
    ...(tags.since === undefined ? {} : { since: tags.since }),
    filePath,
    line
  };
}

interface ResolveConstraintSequencesInput {
  readonly candidate: TaggedCandidate;
  readonly tags: ParsedIndexTags;
  readonly name: string;
  readonly line: number;
  readonly filePath: string;
  readonly warnings: ModelFirebaseIndexExtractWarning[];
}

interface ResolveConstraintSequencesResult {
  readonly constraintSequences: readonly ConstraintSequence[];
  readonly dispatcherDelegates: readonly string[];
}

function resolveConstraintSequences(input: ResolveConstraintSequencesInput): ResolveConstraintSequencesResult {
  const { candidate, tags, name, line, filePath, warnings } = input;
  const bodyResult = extractConstraintsFromBody({ decl: candidate.decl, factoryName: name, filePath, dispatcher: tags.dispatcher });
  for (const warning of bodyResult.warnings) {
    warnings.push(warning);
  }
  if (tags.skip || tags.specOnly || tags.dispatcher || bodyResult.skipped) {
    return { constraintSequences: [], dispatcherDelegates: bodyResult.dispatcherDelegates };
  }
  const constraintSequences = buildConstraintSequences({
    bodyEntries: bodyResult.entries,
    conditionalFields: bodyResult.conditionalFields,
    paths: tags.paths,
    factoryName: name,
    filePath,
    line,
    warnings
  });
  return { constraintSequences, dispatcherDelegates: [] };
}

interface ResolveScopeInput {
  readonly tags: ParsedIndexTags;
  readonly resolved: ResolvedFirestoreModelIdentity;
  readonly name: string;
  readonly filePath: string;
  readonly line: number;
  readonly warnings: ModelFirebaseIndexExtractWarning[];
}

function resolveScope(input: ResolveScopeInput): FirestoreQueryScope | undefined {
  const { tags, resolved, name, filePath, line, warnings } = input;
  let result: FirestoreQueryScope | undefined;
  if (tags.scope === undefined || tags.scope.length === 0) {
    result = resolved.isNested ? 'COLLECTION_GROUP' : 'COLLECTION';
  } else if (VALID_SCOPE_TAG_VALUES.has(tags.scope)) {
    result = tags.scope as FirestoreQueryScope;
  } else {
    warnings.push({ kind: 'unsupported-scope', severity: 'warning', name, scope: tags.scope, filePath, line });
    result = undefined;
  }
  return result;
}

function collectParams(decl: FunctionDeclaration, descriptions: ReadonlyMap<string, string>): readonly ModelFirebaseIndexParamEntry[] {
  const params: readonly ParameterDeclaration[] = decl.getParameters();
  const out: ModelFirebaseIndexParamEntry[] = [];
  for (const param of params) {
    const name = param.getName();
    const typeNode = param.getTypeNode()?.getText();
    const type = typeNode ?? param.getType().getText() ?? 'unknown';
    const description = descriptions.get(name) ?? '';
    const optional = param.isOptional() || param.hasInitializer();
    out.push({ name, type, description, optional });
  }
  return out;
}

// MARK: Path-tag resolution
interface BuildConstraintSequencesInput {
  readonly bodyEntries: readonly ConstraintSequenceEntry[];
  readonly conditionalFields: readonly string[];
  readonly paths: readonly (readonly string[])[];
  readonly factoryName: string;
  readonly filePath: string;
  readonly line: number;
  readonly warnings: ModelFirebaseIndexExtractWarning[];
}

/**
 * Selects the constraint sequences the analyzer should consider for a
 * factory. When the JSDoc declares one or more
 * `@dbxModelFirebaseIndexPath` tags, each tag becomes its own sequence
 * containing only the listed fields (preserved in body source order). When
 * no path tag is declared, falls back to the original single 'all'
 * sequence — and surfaces a `missing-paths` warning if any constraint in
 * the body sits inside an `if` branch (a strong signal the factory needs
 * explicit path declarations).
 *
 * @param input - Extracted body entries, JSDoc-declared paths, warning sink.
 * @returns The sequences to feed the analyzer.
 */
function buildConstraintSequences(input: BuildConstraintSequencesInput): readonly ConstraintSequence[] {
  const { bodyEntries, conditionalFields, paths, factoryName, filePath, line, warnings } = input;

  if (paths.length === 0) {
    if (conditionalFields.length > 0) {
      warnings.push({ kind: 'missing-paths', severity: 'warning', name: factoryName, conditionalFields, filePath, line });
    }
    return [{ pathLabel: 'all', entries: [...bodyEntries] }];
  }

  // Build a quick lookup of body entries by fieldPath. A field can appear
  // multiple times (e.g. `>=` then `<=` for a range), and helpers expand
  // into multiple entries; the path tag selects ALL entries for each
  // listed field, preserving body source order within a single field.
  const entriesByField = new Map<string, ConstraintSequenceEntry[]>();
  for (const entry of bodyEntries) {
    const list = entriesByField.get(entry.fieldPath) ?? [];
    list.push(entry);
    entriesByField.set(entry.fieldPath, list);
  }

  const sequences: ConstraintSequence[] = [];
  for (const path of paths) {
    const selected: ConstraintSequenceEntry[] = [];
    let matchedAnyField = false;
    // Walk in PATH order so the declared order drives the resulting
    // composite. Authors use this to match an already-deployed index whose
    // field order differs from the body's source order.
    for (const field of path) {
      const entriesForField = entriesByField.get(field);
      if (entriesForField === undefined) {
        warnings.push({ kind: 'unknown-path-field', severity: 'warning', name: factoryName, field, filePath, line });
        continue;
      }
      matchedAnyField = true;
      for (const entry of entriesForField) {
        selected.push(entry);
      }
    }
    if (!matchedAnyField) {
      // None of the declared fields matched the body — skip the empty
      // sequence; the `unknown-path-field` warnings already explain why.
      continue;
    }
    sequences.push({ pathLabel: path.join(','), entries: selected });
  }

  return sequences;
}

// MARK: Body walking
interface ExtractConstraintsFromBodyInput {
  readonly decl: FunctionDeclaration;
  readonly factoryName: string;
  readonly filePath: string;
  readonly dispatcher: boolean;
}

interface ExtractConstraintsFromBodyResult {
  readonly entries: readonly ConstraintSequenceEntry[];
  /**
   * Field paths whose constraint call appears inside an `if`/`else if` /
   * ternary branch in the function body. Used by `buildConstraintSequences`
   * to detect dynamic-filter factories that should declare
   * `@dbxModelFirebaseIndexPath` tags.
   */
  readonly conditionalFields: readonly string[];
  readonly warnings: readonly ModelFirebaseIndexExtractWarning[];
  /**
   * True when the body failed a structural check (complex body, or a
   * dispatcher that emits constraints directly) and the caller should treat
   * the entries as unusable.
   */
  readonly skipped: boolean;
  /**
   * Identifier-callee names captured from a dispatcher body, in
   * source order with duplicates removed. Empty when the body is not a
   * dispatcher.
   */
  readonly dispatcherDelegates: readonly string[];
}

function extractConstraintsFromBody(input: ExtractConstraintsFromBodyInput): ExtractConstraintsFromBodyResult {
  const { decl, factoryName, filePath, dispatcher } = input;
  const entries: ConstraintSequenceEntry[] = [];
  const conditionalFieldSet = new Set<string>();
  const warnings: ModelFirebaseIndexExtractWarning[] = [];
  const body = decl.getBody();

  if (dispatcher) {
    const violation = body === undefined ? undefined : findFirstConstraintCall(body);
    if (violation !== undefined) {
      warnings.push({ kind: 'non-delegating-dispatcher', severity: 'error', name: factoryName, callee: violation.callee, filePath, line: violation.line });
    }
    const dispatcherDelegates = body === undefined ? [] : collectDispatcherDelegates(body);
    return { entries, conditionalFields: [], warnings, skipped: true, dispatcherDelegates };
  }

  if (body !== undefined) {
    const branch = findFirstBranchNode(body);
    if (branch !== undefined) {
      warnings.push({ kind: 'complex-query-body', severity: 'error', name: factoryName, branchKind: branch.branchKind, filePath, line: branch.line });
      return { entries, conditionalFields: [], warnings, skipped: true, dispatcherDelegates: [] };
    }
  }

  const initialVisited = new Set<string>([buildDeclKey(decl)]);
  walkBodyInto({
    decl,
    factoryName,
    filePath,
    visited: initialVisited,
    warnings,
    entries,
    conditionalFieldSet,
    forcedConditional: undefined
  });

  // Preserve source order in the result for stable downstream reports.
  const conditionalFields: string[] = [];
  const seenConditional = new Set<string>();
  for (const entry of entries) {
    if (conditionalFieldSet.has(entry.fieldPath) && !seenConditional.has(entry.fieldPath)) {
      seenConditional.add(entry.fieldPath);
      conditionalFields.push(entry.fieldPath);
    }
  }

  return { entries, conditionalFields, warnings, skipped: false, dispatcherDelegates: [] };
}

/**
 * Walks a dispatcher body and returns every identifier-callee name in
 * declaration order, with duplicates removed and `where` / `orderBy` /
 * known query helpers filtered out (those are independently flagged via
 * the `non-delegating-dispatcher` warning).
 *
 * The validator uses this list to credit dispatcher caller counts against
 * the delegated factories — without it, every factory only ever reached
 * through a dispatcher would false-positive on
 * `MODEL_FIREBASE_INDEX_UNUSED_FACTORY`.
 *
 * @param bodyNode - The outer dispatcher function body block.
 * @returns Deduplicated delegate names in source order.
 */
function collectDispatcherDelegates(bodyNode: Node): readonly string[] {
  const calls = bodyNode.getDescendantsOfKind(SyntaxKind.CallExpression);
  calls.sort((a, b) => a.getStart() - b.getStart());
  const seen = new Set<string>();
  const out: string[] = [];
  for (const call of calls) {
    const expression = call.getExpression();
    if (!Node.isIdentifier(expression)) {
      continue;
    }
    const name = expression.getText();
    if (name.length === 0 || seen.has(name)) {
      continue;
    }
    if (name === 'where' || name === 'orderBy' || getFirestoreQueryHelperDescriptor(name) !== undefined) {
      continue;
    }
    seen.add(name);
    out.push(name);
  }
  return out;
}

// MARK: Recursive body walker
interface WalkBodyIntoInput {
  readonly decl: FunctionDeclaration;
  /**
   * Outermost factory name — used for warning attribution.
   */
  readonly factoryName: string;
  /**
   * Outermost factory's file path — used for warning attribution.
   */
  readonly filePath: string;
  /**
   * Set of `${filePath}::${name}` keys already on the call stack.
   */
  readonly visited: ReadonlySet<string>;
  readonly warnings: ModelFirebaseIndexExtractWarning[];
  readonly entries: ConstraintSequenceEntry[];
  readonly conditionalFieldSet: Set<string>;
  /**
   * When `undefined`, this is the outermost body — each call's conditional
   * status is decided by {@link isWithinConditionalBranch}. When a boolean,
   * this is a transitive recursion: every constraint added during this walk
   * inherits this value as its conditional status, mirroring the outer
   * call site's own branch (per the transitive-resolution spec).
   */
  readonly forcedConditional: boolean | undefined;
}

function walkBodyInto(input: WalkBodyIntoInput): void {
  const { decl, forcedConditional } = input;
  const body = decl.getBody();
  if (body === undefined) {
    return;
  }

  const calls = body.getDescendantsOfKind(SyntaxKind.CallExpression);
  calls.sort((a, b) => a.getStart() - b.getStart());

  for (const call of calls) {
    const callee = resolveCallExpressionCallee(call);
    if (callee === undefined) {
      continue;
    }
    const callConditional = forcedConditional ?? isWithinConditionalBranch(call, body);
    processCallExpression({ ...input, body, call, callee, callConditional });
  }
}

interface CallExpressionCallee {
  readonly expression: Node;
  readonly name: string;
  readonly isIdentifierCallee: boolean;
}

function resolveCallExpressionCallee(call: CallExpression): CallExpressionCallee | undefined {
  const expression = call.getExpression();
  const isIdentifierCallee = Node.isIdentifier(expression);
  const isPropertyCallee = Node.isPropertyAccessExpression(expression);
  if (!isIdentifierCallee && !isPropertyCallee) {
    return undefined;
  }
  const name = isIdentifierCallee ? expression.getText() : (expression as { getName: () => string }).getName();
  if (name === undefined) {
    return undefined;
  }
  return { expression, name, isIdentifierCallee };
}

interface ProcessCallExpressionInput extends WalkBodyIntoInput {
  readonly body: Node;
  readonly call: CallExpression;
  readonly callee: CallExpressionCallee;
  readonly callConditional: boolean;
}

function processCallExpression(input: ProcessCallExpressionInput): void {
  const { callee } = input;
  if (callee.name === 'where') {
    handleWhereCall(input);
    return;
  }
  if (callee.name === 'orderBy') {
    handleOrderByCall(input);
    return;
  }
  const descriptor = getFirestoreQueryHelperDescriptor(callee.name);
  if (descriptor !== undefined) {
    handleHelperCall({ ...input, descriptor });
    return;
  }
  if (callee.isIdentifierCallee) {
    tryTransitiveResolution({
      call: input.call,
      identifier: callee.expression as Identifier,
      calleeName: callee.name,
      callConditional: input.callConditional,
      factoryName: input.factoryName,
      filePath: input.filePath,
      visited: input.visited,
      warnings: input.warnings,
      entries: input.entries,
      conditionalFieldSet: input.conditionalFieldSet
    });
  }
}

function pushUnresolvedFieldWarning(input: ProcessCallExpressionInput, calleeLabel: string): void {
  input.warnings.push({ kind: 'unresolved-field', severity: 'warning', name: input.factoryName, callee: calleeLabel, filePath: input.filePath, line: input.call.getStartLineNumber() });
}

function recordConstraintEntry(input: ProcessCallExpressionInput, entry: ConstraintSequenceEntry): void {
  input.entries.push(entry);
  if (input.callConditional) {
    input.conditionalFieldSet.add(entry.fieldPath);
  }
}

function handleWhereCall(input: ProcessCallExpressionInput): void {
  const parsed = parseWhereCall(input.call);
  if (parsed === undefined) {
    pushUnresolvedFieldWarning(input, 'where');
    return;
  }
  recordConstraintEntry(input, parsed);
}

function handleOrderByCall(input: ProcessCallExpressionInput): void {
  const parsed = parseOrderByCall(input.call);
  if (parsed === undefined) {
    pushUnresolvedFieldWarning(input, 'orderBy');
    return;
  }
  recordConstraintEntry(input, parsed);
}

interface HandleHelperCallInput extends ProcessCallExpressionInput {
  readonly descriptor: NonNullable<ReturnType<typeof getFirestoreQueryHelperDescriptor>>;
}

function handleHelperCall(input: HandleHelperCallInput): void {
  const { call, callee, descriptor } = input;
  const args = call.getArguments();
  const fieldArg = args[descriptor.fieldArgIndex];
  const fieldPath = fieldArg === undefined ? undefined : readStringLiteral(fieldArg);
  if (fieldPath === undefined) {
    pushUnresolvedFieldWarning(input, callee.name);
    return;
  }
  const direction = descriptor.directionArgIndex === undefined ? undefined : readDirectionLiteral(args[descriptor.directionArgIndex]);
  for (const expanded of expandFirestoreQueryHelper({ descriptor, fieldPath, direction })) {
    input.entries.push(expanded);
  }
  if (input.callConditional) {
    input.conditionalFieldSet.add(fieldPath);
  }
}

// MARK: Transitive identifier resolution
interface TryTransitiveResolutionInput {
  readonly call: CallExpression;
  readonly identifier: Identifier;
  readonly calleeName: string;
  readonly callConditional: boolean;
  readonly factoryName: string;
  readonly filePath: string;
  readonly visited: ReadonlySet<string>;
  readonly warnings: ModelFirebaseIndexExtractWarning[];
  readonly entries: ConstraintSequenceEntry[];
  readonly conditionalFieldSet: Set<string>;
}

function tryTransitiveResolution(input: TryTransitiveResolutionInput): void {
  const { call, identifier, calleeName, callConditional, factoryName, filePath, visited, warnings, entries, conditionalFieldSet } = input;

  const resolved = resolveCalleeDeclaration(identifier);
  if (resolved === undefined) {
    // Couldn't reach any declaration we can introspect. Stay silent — the
    // identifier might be a local variable, a built-in, or anything else
    // that has nothing to do with Firestore constraints.
    return;
  }

  const returnType = readReturnTypeText(resolved.decl);
  if (!isConstraintRelatedReturnType(returnType)) {
    // The resolved callee isn't a query factory — silently ignore it.
    return;
  }

  // Constraint-related callee without a reachable body (cross-package .d.ts).
  if (!resolved.hasBody) {
    warnings.push({ kind: 'unresolvable-transitive-callee', severity: 'warning', name: factoryName, callee: calleeName, filePath, line: call.getStartLineNumber() });
    return;
  }

  const calleeKey = buildDeclKey(resolved.decl);
  if (visited.has(calleeKey)) {
    warnings.push({ kind: 'transitive-cycle', severity: 'warning', name: factoryName, callee: calleeName, filePath, line: call.getStartLineNumber() });
    return;
  }

  // Whether the callee is tagged with @dbxModelFirebaseIndex. Unannotated
  // constraint factories get a one-shot warning per call site, but we still
  // splice their constraints — the warning is just a nudge to add the tag.
  if (!isIndexTagged(resolved.decl)) {
    const calleeFilePath = resolved.decl.getSourceFile().getFilePath();
    const calleeLine = resolved.decl.getStartLineNumber();
    warnings.push({ kind: 'unannotated-query-helper', severity: 'warning', name: factoryName, callee: calleeName, calleeFilePath, calleeLine, filePath, line: call.getStartLineNumber() });
  }

  const nextVisited = new Set([...visited, calleeKey]);
  walkBodyInto({
    decl: resolved.decl,
    factoryName,
    filePath,
    visited: nextVisited,
    warnings,
    entries,
    conditionalFieldSet,
    forcedConditional: callConditional
  });
}

interface ResolvedCallee {
  readonly decl: FunctionDeclaration;
  readonly hasBody: boolean;
}

/**
 * Resolves an identifier-style call expression's callee to an exported
 * {@link FunctionDeclaration}. Follows import-specifier aliases via the
 * TypeScript symbol table. Returns `undefined` for arrow-function variables,
 * methods, or unresolvable names.
 *
 * @param identifier - The call expression's bare-identifier callee.
 * @returns The resolved declaration and whether it has a body.
 */
function resolveCalleeDeclaration(identifier: Identifier): ResolvedCallee | undefined {
  const symbol = identifier.getSymbol();
  if (symbol === undefined) {
    return undefined;
  }
  const aliased = symbol.getAliasedSymbol();
  const declarations = (aliased ?? symbol).getDeclarations();
  let result: ResolvedCallee | undefined;
  for (const d of declarations) {
    if (Node.isFunctionDeclaration(d) && d.isExported()) {
      result = { decl: d, hasBody: d.getBody() !== undefined };
      break;
    }
  }
  return result;
}

/**
 * String-matches a function's return-type expression against the
 * Firestore-constraint type vocabulary. Conservative on purpose: matches the
 * literal substring `FirestoreQueryConstraint` (with or without `[]`,
 * `<T>`, or `Maker` suffix) so generic instantiations and reasonable aliases
 * are caught without compile-time type evaluation.
 *
 * @param returnType - The resolved return-type text.
 * @returns True when the type looks like a Firestore-query-constraint
 *   return.
 */
function isConstraintRelatedReturnType(returnType: string): boolean {
  if (returnType.length === 0) {
    return false;
  }
  // The token shows up as `FirestoreQueryConstraint`,
  // `FirestoreQueryConstraint[]`, `FirestoreQueryConstraint<Foo>`, or
  // `FirestoreQueryConstraintMaker`. Substring match catches all four.
  return returnType.includes('FirestoreQueryConstraint');
}

function readReturnTypeText(decl: FunctionDeclaration): string {
  const node = decl.getReturnTypeNode();
  return node === undefined ? decl.getReturnType().getText() : node.getText();
}

function isIndexTagged(decl: FunctionDeclaration): boolean {
  let result = false;
  for (const doc of decl.getJsDocs()) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() === INDEX_MARKER) {
        result = true;
        break;
      }
    }
    if (result) {
      break;
    }
  }
  return result;
}

function buildDeclKey(decl: FunctionDeclaration): string {
  const name = decl.getName() ?? '<anonymous>';
  return `${decl.getSourceFile().getFilePath()}::${name}`;
}

/**
 * Returns true when `call` lives inside an `IfStatement`, `ConditionalExpression`,
 * or `SwitchStatement` that is itself nested inside `bodyNode`. Calls placed at
 * the top level of the function body are treated as unconditional.
 *
 * @param call - the where/orderBy/helper call expression
 * @param bodyNode - the outer function body block
 * @returns whether `call` is inside a conditional branch within the body
 */
/**
 * Walks the body looking for the first branching syntax node disallowed by the
 * "one query per index" convention. Returns the branch kind and starting line
 * so the warning can point the author at the offending construct.
 *
 * Note: `BinaryExpression` (`&&`/`||`) and `NullishCoalescing` (`??`) are NOT
 * flagged. `??` is commonly used to default an argument value (`now ?? new Date()`),
 * and the strict-shape rule does not need to police every short-circuit. The
 * branching constructs in {@link COMPLEX_BODY_SYNTAX_KINDS} cover the cases
 * authors actually use to build different constraint sets per call.
 *
 * @param bodyNode - The outer function body block.
 * @returns The first disallowed branch's kind + line, or undefined when clean.
 */
function findFirstBranchNode(bodyNode: Node): { readonly branchKind: ComplexQueryBranchKind; readonly line: number } | undefined {
  let result: { readonly branchKind: ComplexQueryBranchKind; readonly line: number } | undefined;
  for (const [syntaxKind, branchKind] of COMPLEX_BODY_SYNTAX_KINDS) {
    const nodes = bodyNode.getDescendantsOfKind(syntaxKind);
    if (nodes.length > 0) {
      const first = nodes.sort((a, b) => a.getStart() - b.getStart())[0];
      const line = first.getStartLineNumber();
      if (result === undefined || line < result.line) {
        result = { branchKind, line };
      }
    }
  }
  return result;
}

/**
 * Resolves the textual callee name for a call expression's left-hand side
 * (Identifier or PropertyAccessExpression).
 *
 * @param expression - The call expression's leading node.
 * @returns The callee identifier name, or undefined when the form is unsupported.
 */
function getCallExpressionName(expression: Node): string | undefined {
  if (Node.isIdentifier(expression)) {
    return expression.getText();
  }
  if (Node.isPropertyAccessExpression(expression)) {
    return (expression as { getName: () => string }).getName();
  }
  return undefined;
}

/**
 * Walks the body looking for the first call to `where`, `orderBy`, or any
 * registered Firestore query helper. Used to enforce that dispatcher-tagged
 * factories only delegate to other query functions and never emit constraints
 * directly.
 *
 * @param bodyNode - The outer function body block.
 * @returns The offending call's callee name + line, or undefined when clean.
 */
function findFirstConstraintCall(bodyNode: Node): { readonly callee: string; readonly line: number } | undefined {
  const calls = bodyNode.getDescendantsOfKind(SyntaxKind.CallExpression);
  calls.sort((a, b) => a.getStart() - b.getStart());
  let result: { readonly callee: string; readonly line: number } | undefined;
  for (const call of calls) {
    const expression = call.getExpression();
    const calleeName = getCallExpressionName(expression);
    if (calleeName === undefined) {
      continue;
    }
    if (calleeName === 'where' || calleeName === 'orderBy' || getFirestoreQueryHelperDescriptor(calleeName) !== undefined) {
      result = { callee: calleeName, line: call.getStartLineNumber() };
      break;
    }
  }
  return result;
}

function isWithinConditionalBranch(call: CallExpression, bodyNode: Node): boolean {
  let node: Node | undefined = call.getParent();
  let result = false;
  while (node !== undefined && node !== bodyNode) {
    const kind = node.getKind();
    if (kind === SyntaxKind.IfStatement || kind === SyntaxKind.ConditionalExpression || kind === SyntaxKind.SwitchStatement || kind === SyntaxKind.CaseClause) {
      result = true;
      break;
    }
    node = node.getParent();
  }
  return result;
}

function parseWhereCall(call: CallExpression): ConstraintSequenceEntry | undefined {
  const args = call.getArguments();
  if (args.length < 2) {
    return undefined;
  }
  const fieldPath = readStringLiteral(args[0]);
  if (fieldPath === undefined) {
    return undefined;
  }
  // The operator may be a dynamic expression (e.g. `stateComparison ?? '=='`).
  // Composite-index bucketing for equality, range, and array operators
  // produces the same field order — only the operator's bucket changes.
  // When the literal can't be resolved, fall back to '==' so the field
  // still participates in the index. The default favours the common case
  // (equality filters) and matches what Firestore deploys when authors
  // use a parameterised operator.
  const opLiteral = readStringLiteral(args[1]);
  let operator: FirestoreWhereOperator = '==';
  if (opLiteral !== undefined && WHERE_OPERATOR_SET.has(opLiteral)) {
    operator = opLiteral as FirestoreWhereOperator;
  }
  return { kind: 'where', fieldPath, operator };
}

function parseOrderByCall(call: CallExpression): ConstraintSequenceEntry | undefined {
  const args = call.getArguments();
  if (args.length === 0) {
    return undefined;
  }
  const fieldPath = readStringLiteral(args[0]);
  if (fieldPath === undefined) {
    return undefined;
  }
  const direction = readDirectionLiteral(args[1]) ?? 'asc';
  return { kind: 'orderBy', fieldPath, direction };
}

function readStringLiteral(node: Node | undefined): string | undefined {
  let result: string | undefined;
  if (node !== undefined && (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))) {
    result = node.getLiteralText();
  }
  return result;
}

function readDirectionLiteral(node: Node | undefined): 'asc' | 'desc' | undefined {
  const text = readStringLiteral(node);
  let result: 'asc' | 'desc' | undefined;
  if (text === 'asc' || text === 'desc') {
    result = text;
  }
  return result;
}

// MARK: Defaults
/**
 * Converts an export name into its kebab-case slug form. Handles
 * camelCase (`jobLocationWeeksDirty` → `job-location-weeks-dirty`) and
 * SCREAMING_SNAKE_CASE; already-kebab inputs pass through unchanged.
 *
 * @param name - The export identifier.
 * @returns The kebab-case slug.
 */
export function toKebabCase(name: string): string {
  if (name.length === 0) {
    return '';
  }
  const withSeparators = name
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replaceAll(/_+/g, '-')
    .replaceAll(/\s+/g, '-');
  return withSeparators.toLowerCase();
}

const STOPWORDS: ReadonlySet<string> = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at', 'is', 'are', 'be', 'this', 'that', 'with', 'when', 'if', 'as', 'by', 'from', 'into', 'returns', 'return', 'query']);

interface BuildTagSetInput {
  readonly name: string;
  readonly slug: string;
  readonly summary: string;
  readonly explicit: readonly string[];
  readonly category: string;
  readonly model: string;
}

function buildTagSet(input: BuildTagSetInput): readonly string[] {
  const { name, slug, summary, explicit, category, model } = input;
  const out: string[] = [];
  const seen = new Set<string>();

  function add(token: string): void {
    const lower = token.toLowerCase();
    if (lower.length === 0 || seen.has(lower)) {
      return;
    }
    seen.add(lower);
    out.push(lower);
  }

  for (const tag of explicit) {
    add(tag);
  }
  add(category);
  add(model);
  for (const piece of slug.split('-')) {
    add(piece);
  }
  add(name);
  for (const piece of toKebabCase(model).split('-')) {
    add(piece);
  }

  if (explicit.length === 0) {
    const summaryTokens = summary
      .toLowerCase()
      .replaceAll(/[^a-z0-9\s]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t));
    let added = 0;
    for (const token of summaryTokens) {
      if (added >= 8) {
        break;
      }
      const before = out.length;
      add(token);
      if (out.length > before) {
        added += 1;
      }
    }
  }
  return out;
}
