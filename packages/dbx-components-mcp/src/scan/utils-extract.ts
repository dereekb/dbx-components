/**
 * AST extraction for the `scan-utils` generator.
 *
 * Walks every source file in the supplied ts-morph `Project` looking for
 * top-level exported declarations (functions, classes, `const` variable
 * statements) tagged with the `@dbxUtil` JSDoc marker. Each match is
 * normalised into an {@link ExtractedUtilEntry} that
 * {@link buildUtilsManifest} assembles into a `UtilManifest` entry.
 *
 * Optional sub-tags supply overrides that can't be reliably auto-derived
 * (slug, category, tags, related slugs, skill refs, kind). Sensible
 * defaults are computed for each from the source — kebab-case of the
 * export name, the parent folder of the source file, the export name +
 * first JSDoc paragraph tokens, etc.
 *
 * The extractor prefers syntactic nodes (`getReturnTypeNode()`,
 * `getTypeNode()`) and only falls back to type-checker inference
 * (`getReturnType()`, `getType()`) when an explicit type annotation is
 * absent. The syntactic-first path keeps the common case cheap on
 * in-memory fixtures while still surfacing inferred types when authors
 * elide them.
 */

import { Node, type ClassDeclaration, type FunctionDeclaration, type JSDoc, type ParameterDeclaration, type Project, type SourceFile, type VariableDeclaration, type VariableStatement } from 'ts-morph';
import type { UtilEntry, UtilKindValue, UtilParamEntry } from '../manifest/utils-schema.js';
import { splitListTagText, unwrapFenced } from './scan-extract-utils.js';

// MARK: Tag names
const UTIL_MARKER = 'dbxUtil';
const UTIL_SLUG_TAG = 'dbxUtilSlug';
const UTIL_CATEGORY_TAG = 'dbxUtilCategory';
const UTIL_TAGS_TAG = 'dbxUtilTags';
const UTIL_RELATED_TAG = 'dbxUtilRelated';
const UTIL_SKILL_REFS_TAG = 'dbxUtilSkillRefs';
const UTIL_KIND_TAG = 'dbxUtilKind';

// MARK: Public types
/**
 * One util entry extracted from a source file. Mirrors {@link UtilEntry}
 * minus `module` (derived from the package being scanned in
 * build-manifest) and `subpath` (also derived in build-manifest from the
 * project root). `filePath` and `line` are kept for in-process warnings
 * and never persisted to the manifest.
 */
export interface ExtractedUtilEntry {
  readonly slug: string;
  readonly name: string;
  readonly kind: UtilKindValue;
  readonly category: string;
  readonly signature: string;
  readonly description: string;
  readonly params: readonly UtilParamEntry[];
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
 * entry can't be assembled. Build-manifest collates these into a
 * structured warning array so missing/invalid tag combinations surface
 * during generation rather than silently dropping entries.
 */
export type UtilExtractWarning = { readonly kind: 'unsupported-kind-override'; readonly name: string; readonly override: string; readonly filePath: string; readonly line: number } | { readonly kind: 'missing-name'; readonly filePath: string; readonly line: number } | { readonly kind: 'duplicate-slug'; readonly name: string; readonly slug: string; readonly previousName: string; readonly filePath: string; readonly line: number };

/**
 * Input to {@link extractUtilEntries}. The caller is responsible for
 * adding source files to `project`.
 */
export interface ExtractUtilEntriesInput {
  readonly project: Project;
  /**
   * Repo-relative project root (e.g. `packages/util`). The extractor uses
   * this so it can drop the project prefix from the warning `filePath`
   * fields and so the build-manifest layer can compute `subpath` against
   * a stable base.
   */
  readonly projectRoot?: string;
}

/**
 * Result of {@link extractUtilEntries}.
 */
export interface ExtractUtilEntriesResult {
  readonly entries: readonly ExtractedUtilEntry[];
  readonly warnings: readonly UtilExtractWarning[];
}

const VALID_KIND_OVERRIDES: ReadonlySet<string> = new Set(['function', 'class', 'const', 'factory']);

// MARK: Entry point
/**
 * Walks the supplied project and returns every export tagged with the
 * `@dbxUtil` JSDoc marker. Order is stable: source files in the order
 * ts-morph reports them, declarations within a file in source order.
 *
 * @param input - the ts-morph project to scan
 * @returns the extracted entries plus any non-fatal warnings
 */
export function extractUtilEntries(input: ExtractUtilEntriesInput): ExtractUtilEntriesResult {
  const { project } = input;
  const entries: ExtractedUtilEntry[] = [];
  const warnings: UtilExtractWarning[] = [];
  const slugProvenance = new Map<string, { readonly name: string; readonly filePath: string; readonly line: number }>();

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const candidates = collectTaggedExports(sourceFile);
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

// MARK: Candidate collection
type TaggedCandidate = { readonly kind: 'function'; readonly decl: FunctionDeclaration; readonly jsDocs: readonly JSDoc[] } | { readonly kind: 'class'; readonly decl: ClassDeclaration; readonly jsDocs: readonly JSDoc[] } | { readonly kind: 'variable'; readonly statement: VariableStatement; readonly decl: VariableDeclaration; readonly jsDocs: readonly JSDoc[] };

function collectTaggedExports(sourceFile: SourceFile): readonly TaggedCandidate[] {
  const combined: TaggedCandidate[] = [...collectTaggedFunctions(sourceFile), ...collectTaggedClasses(sourceFile), ...collectTaggedVariables(sourceFile)];
  combined.sort((a, b) => candidateSourceStart(a) - candidateSourceStart(b));
  return combined;
}

function candidateSourceStart(candidate: TaggedCandidate): number {
  return candidate.kind === 'variable' ? candidate.statement.getStart() : candidate.decl.getStart();
}

function collectTaggedFunctions(sourceFile: SourceFile): readonly TaggedCandidate[] {
  const out: TaggedCandidate[] = [];
  for (const decl of sourceFile.getFunctions()) {
    if (!decl.isExported()) {
      continue;
    }
    // ts-morph's sourceFile.getFunctions() returns only the implementation for overloaded
    // functions. Overload signatures are where authors typically put the JSDoc, so collect
    // their docs too and merge with the implementation's. The implementation FunctionDeclaration
    // remains the canonical decl used for params/return-type extraction.
    const overloadDocs = decl.getOverloads().flatMap((overload) => overload.getJsDocs());
    const jsDocs = findTaggedDocs([...overloadDocs, ...decl.getJsDocs()]);
    if (jsDocs.length > 0) {
      out.push({ kind: 'function', decl, jsDocs });
    }
  }
  return out;
}

function collectTaggedClasses(sourceFile: SourceFile): readonly TaggedCandidate[] {
  const out: TaggedCandidate[] = [];
  for (const decl of sourceFile.getClasses()) {
    if (!decl.isExported()) {
      continue;
    }
    const jsDocs = findTaggedDocs(decl.getJsDocs());
    if (jsDocs.length > 0) {
      out.push({ kind: 'class', decl, jsDocs });
    }
  }
  return out;
}

function collectTaggedVariables(sourceFile: SourceFile): readonly TaggedCandidate[] {
  const out: TaggedCandidate[] = [];
  for (const statement of sourceFile.getVariableStatements()) {
    if (!statement.isExported()) {
      continue;
    }
    const jsDocs = findTaggedDocs(statement.getJsDocs());
    if (jsDocs.length === 0) {
      continue;
    }
    for (const decl of statement.getDeclarations()) {
      out.push({ kind: 'variable', statement, decl, jsDocs });
    }
  }
  return out;
}

function findTaggedDocs(jsDocs: readonly JSDoc[]): readonly JSDoc[] {
  let hasMarker = false;
  for (const doc of jsDocs) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() === UTIL_MARKER) {
        hasMarker = true;
      }
    }
  }
  return hasMarker ? jsDocs : [];
}

// MARK: JSDoc parsing
interface ParsedUtilTags {
  readonly summary: string;
  readonly slug?: string;
  readonly category?: string;
  readonly explicitTags: readonly string[];
  readonly relatedSlugs: readonly string[];
  readonly skillRefs: readonly string[];
  readonly kindOverride?: string;
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
  readonly examples: string[];
  readonly paramDescriptions: Map<string, string>;
  returnsText: string | undefined;
  deprecated: boolean | string | undefined;
  since: string | undefined;
}

function readJsDocTags(jsDocs: readonly JSDoc[]): ParsedUtilTags {
  const state: MutableTagState = {
    summaries: [],
    slug: undefined,
    category: undefined,
    explicitTags: [],
    relatedSlugs: [],
    skillRefs: [],
    kindOverride: undefined,
    examples: [],
    paramDescriptions: new Map(),
    returnsText: undefined,
    deprecated: undefined,
    since: undefined
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
        applyJsDocTag(state, tagName, text);
      }
    }
  }

  return {
    summary: state.summaries.join('\n\n'),
    slug: state.slug,
    category: state.category,
    explicitTags: state.explicitTags,
    relatedSlugs: state.relatedSlugs,
    skillRefs: state.skillRefs,
    kindOverride: state.kindOverride,
    examples: state.examples,
    paramDescriptions: state.paramDescriptions,
    returnsText: state.returnsText,
    deprecated: state.deprecated,
    since: state.since
  };
}

function applyJsDocTag(state: MutableTagState, name: string, text: string): void {
  switch (name) {
    case UTIL_MARKER:
      break;
    case UTIL_SLUG_TAG:
      state.slug = text;
      break;
    case UTIL_CATEGORY_TAG:
      state.category = text;
      break;
    case UTIL_TAGS_TAG:
      for (const tag of splitListTagText(text)) {
        state.explicitTags.push(tag.toLowerCase());
      }
      break;
    case UTIL_RELATED_TAG:
      for (const slug of splitListTagText(text)) {
        state.relatedSlugs.push(slug);
      }
      break;
    case UTIL_SKILL_REFS_TAG:
      for (const ref of splitListTagText(text)) {
        state.skillRefs.push(ref);
      }
      break;
    case UTIL_KIND_TAG:
      state.kindOverride = text;
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

function extractParamName(rawTag: string): string | undefined {
  const match = /@param\s+(?:\{[^}]*\}\s+)?(\S+)/.exec(rawTag);
  return match?.[1];
}

// MARK: Entry construction
interface BuildEntryInput {
  readonly candidate: TaggedCandidate;
  readonly filePath: string;
}

type BuildEntryResult = { readonly kind: 'ok'; readonly entry: ExtractedUtilEntry; readonly warnings: readonly UtilExtractWarning[] } | { readonly kind: 'skipped'; readonly warnings: readonly UtilExtractWarning[] };

type ResolveKindResult = { readonly ok: true; readonly kind: UtilKindValue } | { readonly ok: false; readonly warning: UtilExtractWarning };

interface ResolveKindInput {
  readonly name: string;
  readonly kindOverride: string | undefined;
  readonly defaultKind: UtilKindValue;
  readonly filePath: string;
  readonly line: number;
}

function resolveEntryKind(input: ResolveKindInput): ResolveKindResult {
  const { name, kindOverride, defaultKind, filePath, line } = input;
  let result: ResolveKindResult;
  if (kindOverride === undefined || kindOverride.length === 0) {
    result = { ok: true, kind: defaultKind };
  } else if (VALID_KIND_OVERRIDES.has(kindOverride)) {
    result = { ok: true, kind: kindOverride as UtilKindValue };
  } else {
    result = { ok: false, warning: { kind: 'unsupported-kind-override', name, override: kindOverride, filePath, line } };
  }
  return result;
}

function buildEntry(input: BuildEntryInput): BuildEntryResult {
  const { candidate, filePath } = input;
  const warnings: UtilExtractWarning[] = [];

  const meta = readCandidateMeta(candidate);
  if (meta.name === undefined || meta.name.length === 0) {
    warnings.push({ kind: 'missing-name', filePath, line: meta.line });
    return { kind: 'skipped', warnings };
  }

  const tags = readJsDocTags(candidate.jsDocs);
  const kindResult = resolveEntryKind({ name: meta.name, kindOverride: tags.kindOverride, defaultKind: meta.defaultKind, filePath, line: meta.line });
  if (!kindResult.ok) {
    warnings.push(kindResult.warning);
    return { kind: 'skipped', warnings };
  }
  const kind = kindResult.kind;

  const slug = tags.slug && tags.slug.length > 0 ? tags.slug : toKebabCase(meta.name);
  const category = tags.category && tags.category.length > 0 ? tags.category : deriveCategoryFromPath(filePath);
  const params = collectParams(candidate, tags.paramDescriptions);
  const returns = tags.returnsText && tags.returnsText.length > 0 ? tags.returnsText : meta.defaultReturnTypeText;
  const signature = buildSignature({ name: meta.name, kind, params, returnType: meta.defaultReturnTypeText });
  const example = tags.examples.length > 0 ? tags.examples[0] : '';
  const tagSet = buildTagSet({ name: meta.name, slug, summary: tags.summary, explicit: tags.explicitTags, category });

  const entry: ExtractedUtilEntry = {
    slug,
    name: meta.name,
    kind,
    category,
    signature,
    description: tags.summary,
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
  readonly defaultKind: UtilKindValue;
  readonly defaultReturnTypeText: string;
}

function readCandidateMeta(candidate: TaggedCandidate): CandidateMeta {
  let result: CandidateMeta;
  if (candidate.kind === 'function') {
    const returnType = candidate.decl.getReturnTypeNode()?.getText() ?? candidate.decl.getReturnType().getText();
    const isFactory = isFactoryReturnType(returnType);
    result = {
      name: candidate.decl.getName(),
      line: candidate.decl.getStartLineNumber(),
      defaultKind: isFactory ? 'factory' : 'function',
      defaultReturnTypeText: returnType
    };
  } else if (candidate.kind === 'class') {
    result = {
      name: candidate.decl.getName(),
      line: candidate.decl.getStartLineNumber(),
      defaultKind: 'class',
      defaultReturnTypeText: candidate.decl.getName() ?? ''
    };
  } else {
    const initializer = candidate.decl.getInitializer();
    let defaultKind: UtilKindValue = 'const';
    let returnTypeText = '';
    if (initializer !== undefined && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
      const declaredReturn = initializer.getReturnTypeNode()?.getText();
      const inferred = declaredReturn ?? initializer.getReturnType().getText();
      defaultKind = isFactoryReturnType(inferred) ? 'factory' : 'function';
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

function isFactoryReturnType(returnTypeText: string): boolean {
  const trimmed = returnTypeText.trim();
  return trimmed.includes('=>') || /^\([^)]*\)\s*=>/.test(trimmed);
}

function collectParams(candidate: TaggedCandidate, descriptions: ReadonlyMap<string, string>): readonly UtilParamEntry[] {
  let params: readonly ParameterDeclaration[] = [];
  if (candidate.kind === 'function') {
    params = candidate.decl.getParameters();
  } else if (candidate.kind === 'class') {
    const ctor = candidate.decl.getConstructors()[0];
    params = ctor === undefined ? [] : ctor.getParameters();
  } else {
    const initializer = candidate.decl.getInitializer();
    if (initializer !== undefined && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
      params = initializer.getParameters();
    }
  }
  const out: UtilParamEntry[] = [];
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

interface BuildSignatureInput {
  readonly name: string;
  readonly kind: UtilKindValue;
  readonly params: readonly UtilParamEntry[];
  readonly returnType: string;
}

function buildSignature(input: BuildSignatureInput): string {
  const { name, kind, params, returnType } = input;
  let result: string;
  if (kind === 'class') {
    result = `class ${name}`;
  } else if (kind === 'const') {
    result = `const ${name}: ${returnType.length > 0 ? returnType : 'unknown'}`;
  } else {
    const paramList = params.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ');
    result = `${name}(${paramList}): ${returnType.length > 0 ? returnType : 'unknown'}`;
  }
  return result;
}

// MARK: Defaults
/**
 * Converts an export name into its kebab-case slug form. Handles
 * camelCase (`expirationDetails` → `expiration-details`) and PascalCase
 * (`ExpirationDetails` → `expiration-details`); already-kebab inputs pass
 * through unchanged.
 *
 * @param name - the export identifier
 * @returns the kebab-case slug
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

const PROJECT_PREFIX_PATTERNS = ['/src/lib/', '/src/'];

/**
 * Picks a default `category` from a source file path. The category is the
 * first folder beneath `src/lib/` (or `src/` when `src/lib/` isn't
 * present), so `packages/util/src/lib/date/expires.ts` → `date`.
 *
 * @param filePath - the absolute or repo-relative path to the source file
 * @returns the derived category slug, or `'misc'` when no folder is found
 */
export function deriveCategoryFromPath(filePath: string): string {
  const normalised = filePath.replaceAll('\\', '/');
  let category: string | undefined;
  for (const prefix of PROJECT_PREFIX_PATTERNS) {
    const idx = normalised.indexOf(prefix);
    if (idx >= 0) {
      const remainder = normalised.slice(idx + prefix.length);
      const parts = remainder.split('/');
      if (parts.length >= 2 && parts[0].length > 0) {
        category = parts[0];
        break;
      }
    }
  }
  return category ?? 'misc';
}

const STOPWORDS: ReadonlySet<string> = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at', 'is', 'are', 'be', 'this', 'that', 'with', 'when', 'if', 'as', 'by', 'from', 'into', 'one', 'two', 'true', 'false', 'returns', 'return', 'value', 'values']);

interface BuildTagSetInput {
  readonly name: string;
  readonly slug: string;
  readonly summary: string;
  readonly explicit: readonly string[];
  readonly category: string;
}

function buildTagSet(input: BuildTagSetInput): readonly string[] {
  const { name, slug, summary, explicit, category } = input;
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
  for (const piece of slug.split('-')) {
    add(piece);
  }
  add(name);
  for (const piece of toKebabCase(name).split('-')) {
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
