/**
 * Shared infrastructure for the `*-extract.ts` modules that walk a ts-morph
 * `Project` looking for JSDoc-tagged exports.
 *
 * Each per-domain extractor (utils, model-snapshot-fields, …) repeats the
 * same scaffolding: pull every exported function/class/variable statement,
 * check whether it carries a domain-specific JSDoc marker tag, normalise the
 * tag list, parse common JSDoc fields (summary, params, returns, examples,
 * deprecated/since), extract parameter declarations, and derive a default
 * kebab-case slug + category from the source file's path.
 *
 * Lifting that scaffolding here keeps each per-domain extractor focused on
 * its domain-specific differences (marker names, kind union, optional field
 * derivation, …) instead of repeating the AST plumbing.
 */

import { Node, type ClassDeclaration, type FunctionDeclaration, type JSDoc, type ParameterDeclaration, type SourceFile, type VariableDeclaration, type VariableStatement } from 'ts-morph';

// MARK: Candidate union
/**
 * Tagged exported function declaration. The `decl` is the implementation
 * (ts-morph returns only the impl for overloaded functions); `jsDocs` may
 * include docs aggregated from overload signatures when the collector ran
 * with `includeOverloadDocs: true`.
 */
export interface TaggedExportFunctionCandidate {
  readonly kind: 'function';
  readonly decl: FunctionDeclaration;
  readonly jsDocs: readonly JSDoc[];
}

/**
 * Tagged exported class declaration. Only emitted when
 * {@link collectTaggedExports} was called with `includeClasses: true`.
 */
export interface TaggedExportClassCandidate {
  readonly kind: 'class';
  readonly decl: ClassDeclaration;
  readonly jsDocs: readonly JSDoc[];
}

/**
 * Tagged exported variable declaration. Emitted once per declaration in an
 * `export const x = …, y = …` statement; `statement` is the enclosing
 * VariableStatement so callers can read its JSDoc and source position.
 */
export interface TaggedExportVariableCandidate {
  readonly kind: 'variable';
  readonly statement: VariableStatement;
  readonly decl: VariableDeclaration;
  readonly jsDocs: readonly JSDoc[];
}

/**
 * Discriminated union over the three tagged-export shapes the per-domain
 * extractors care about. Helpers below operate on the wider union; per-
 * domain extractors typically narrow to `function | variable` by not
 * enabling `includeClasses`.
 */
export type TaggedExportCandidate = TaggedExportFunctionCandidate | TaggedExportClassCandidate | TaggedExportVariableCandidate;

// MARK: Tagged-doc detection
/**
 * Returns the original JSDoc list when at least one tag in any doc has
 * `tagName === markerName`, otherwise an empty array. Used by the per-
 * collector helpers below to skip undecorated exports cheaply.
 *
 * @param jsDocs - The JSDocs attached to an exported declaration.
 * @param markerName - The marker tag name (without `@`, e.g. `'dbxUtil'`).
 * @returns The input docs when the marker was found, else `[]`.
 */
export function findTaggedDocs(jsDocs: readonly JSDoc[], markerName: string): readonly JSDoc[] {
  let hasMarker = false;
  for (const doc of jsDocs) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() === markerName) {
        hasMarker = true;
      }
    }
  }
  return hasMarker ? jsDocs : [];
}

// MARK: Per-kind collectors
/**
 * Options for {@link collectTaggedFunctions}.
 */
export interface CollectTaggedFunctionsOptions {
  /**
   * When `true`, JSDoc from overload signatures is merged with the
   * implementation's JSDoc (overloads are where authors typically put
   * `@param` and `@returns`). Defaults to `false`.
   */
  readonly includeOverloadDocs?: boolean;
}

/**
 * Collects exported function declarations whose JSDoc carries `markerName`.
 *
 * @param sourceFile - The ts-morph source file to scan.
 * @param markerName - The marker tag name (e.g. `'dbxUtil'`).
 * @param options - Optional flags (see {@link CollectTaggedFunctionsOptions}).
 * @returns The tagged function candidates in source order.
 */
export function collectTaggedFunctions(sourceFile: SourceFile, markerName: string, options?: CollectTaggedFunctionsOptions): readonly TaggedExportFunctionCandidate[] {
  const includeOverloadDocs = options?.includeOverloadDocs === true;
  const out: TaggedExportFunctionCandidate[] = [];
  for (const decl of sourceFile.getFunctions()) {
    if (!decl.isExported()) {
      continue;
    }
    // ts-morph's sourceFile.getFunctions() returns only the implementation for overloaded
    // functions. Overload signatures are where authors typically put the JSDoc, so collect
    // their docs too when requested and merge with the implementation's. The implementation
    // FunctionDeclaration remains the canonical decl used for params/return-type extraction.
    const overloadDocs = includeOverloadDocs ? decl.getOverloads().flatMap((overload) => overload.getJsDocs()) : [];
    const jsDocs = findTaggedDocs([...overloadDocs, ...decl.getJsDocs()], markerName);
    if (jsDocs.length > 0) {
      out.push({ kind: 'function', decl, jsDocs });
    }
  }
  return out;
}

/**
 * Collects exported class declarations whose JSDoc carries `markerName`.
 *
 * @param sourceFile - The ts-morph source file to scan.
 * @param markerName - The marker tag name.
 * @returns The tagged class candidates in source order.
 */
export function collectTaggedClasses(sourceFile: SourceFile, markerName: string): readonly TaggedExportClassCandidate[] {
  const out: TaggedExportClassCandidate[] = [];
  for (const decl of sourceFile.getClasses()) {
    if (!decl.isExported()) {
      continue;
    }
    const jsDocs = findTaggedDocs(decl.getJsDocs(), markerName);
    if (jsDocs.length > 0) {
      out.push({ kind: 'class', decl, jsDocs });
    }
  }
  return out;
}

/**
 * Collects exported variable declarations whose enclosing
 * `VariableStatement`'s JSDoc carries `markerName`. Emits one candidate per
 * declaration in a comma-separated `export const a = …, b = …` statement.
 *
 * @param sourceFile - The ts-morph source file to scan.
 * @param markerName - The marker tag name.
 * @returns The tagged variable candidates in source order.
 */
export function collectTaggedVariables(sourceFile: SourceFile, markerName: string): readonly TaggedExportVariableCandidate[] {
  const out: TaggedExportVariableCandidate[] = [];
  for (const statement of sourceFile.getVariableStatements()) {
    if (!statement.isExported()) {
      continue;
    }
    const jsDocs = findTaggedDocs(statement.getJsDocs(), markerName);
    if (jsDocs.length === 0) {
      continue;
    }
    for (const decl of statement.getDeclarations()) {
      out.push({ kind: 'variable', statement, decl, jsDocs });
    }
  }
  return out;
}

// MARK: Aggregated collection
/**
 * Options for {@link collectTaggedExports}.
 */
export interface CollectTaggedExportsOptions {
  /**
   * When `true`, exported classes carrying `markerName` are included.
   * Defaults to `false` — most per-domain extractors only care about
   * function and variable exports.
   */
  readonly includeClasses?: boolean;
  /**
   * Forwarded to {@link collectTaggedFunctions}. Defaults to `false`.
   */
  readonly includeOverloadDocs?: boolean;
}

/**
 * Source-position of a candidate, used by {@link collectTaggedExports} to
 * sort the combined output in source order.
 *
 * @param candidate - The tagged-export candidate to position.
 * @returns The 0-based start offset within the source file.
 */
export function candidateSourceStart(candidate: TaggedExportCandidate): number {
  return candidate.kind === 'variable' ? candidate.statement.getStart() : candidate.decl.getStart();
}

/**
 * Combines the per-kind collectors and returns the candidates in source
 * order.
 *
 * @param sourceFile - The ts-morph source file to scan.
 * @param markerName - The marker tag name.
 * @param options - Optional flags (see {@link CollectTaggedExportsOptions}).
 * @returns The combined candidate list in source order.
 */
export function collectTaggedExports(sourceFile: SourceFile, markerName: string, options?: CollectTaggedExportsOptions): readonly TaggedExportCandidate[] {
  const combined: TaggedExportCandidate[] = [...collectTaggedFunctions(sourceFile, markerName, options), ...collectTaggedVariables(sourceFile, markerName)];
  if (options?.includeClasses === true) {
    combined.push(...collectTaggedClasses(sourceFile, markerName));
  }
  combined.sort((a, b) => candidateSourceStart(a) - candidateSourceStart(b));
  return combined;
}

// MARK: JSDoc walking
/**
 * Callback bundle for {@link walkJsDocs}.
 */
export interface JsDocTagHandlers {
  /**
   * Invoked once per JSDoc block whose description text (the prose above
   * the tag list) is non-empty.
   */
  readonly onSummary: (summary: string) => void;
  /**
   * Invoked once per `@param` tag with the documented parameter name and
   * its description text (both trimmed; `paramName` is `undefined`-filtered
   * before the callback so it's always a non-empty string).
   */
  readonly onParam: (paramName: string, text: string) => void;
  /**
   * Invoked once per non-`@param` tag.
   */
  readonly onTag: (tagName: string, text: string) => void;
}

/**
 * Walks a list of JSDoc blocks, dispatching descriptions, `@param` tags,
 * and the remaining tags to the supplied callbacks.
 *
 * @param jsDocs - The JSDocs to walk.
 * @param handlers - The summary/param/tag callbacks.
 */
export function walkJsDocs(jsDocs: readonly JSDoc[], handlers: JsDocTagHandlers): void {
  for (const jsDoc of jsDocs) {
    const description = jsDoc.getDescription().trim();
    if (description.length > 0) {
      handlers.onSummary(description);
    }
    for (const tag of jsDoc.getTags()) {
      const tagName = tag.getTagName();
      const text = tag.getCommentText()?.trim() ?? '';
      if (tagName === 'param') {
        const paramName = (tag as unknown as { getName?: () => string }).getName?.() ?? extractParamNameFromRawTag(tag.getText());
        if (paramName !== undefined && paramName.length > 0) {
          handlers.onParam(paramName, text);
        }
      } else {
        handlers.onTag(tagName, text);
      }
    }
  }
}

/**
 * Best-effort extraction of the parameter name from a raw `@param ...` tag
 * text when ts-morph's typed accessor isn't available (older AST shapes).
 *
 * @param rawTag - The raw `@param` tag text.
 * @returns The parameter name, or `undefined` when the tag doesn't match.
 */
export function extractParamNameFromRawTag(rawTag: string): string | undefined {
  const match = /@param\s+(?:\{[^}]*\}\s+)?(\S+)/.exec(rawTag);
  return match?.[1];
}

// MARK: Param extraction
/**
 * Shared parameter shape produced by {@link extractCandidateParams}.
 * Matches the structure of both `UtilParamEntry` and
 * `ModelSnapshotFieldParamEntry` so per-domain extractors can pass it
 * straight through.
 */
export interface ExtractedParam {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly optional: boolean;
}

/**
 * Returns the parameter declarations for a candidate. For functions, this
 * is the impl's parameter list; for classes, the first constructor's; for
 * variables initialized with an arrow function or function expression, the
 * initializer's. Otherwise (a plain `const` like
 * `firestorePassthroughField`), an empty list.
 *
 * @param candidate - The candidate to inspect.
 * @returns The parameter declarations, possibly empty.
 */
export function getCandidateParameters(candidate: TaggedExportCandidate): readonly ParameterDeclaration[] {
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
  return params;
}

/**
 * Reads a candidate's parameters, pairing each with its JSDoc-`@param`
 * description (or empty string when none was documented).
 *
 * @param candidate - The candidate whose parameters to extract.
 * @param descriptions - Map from parameter name to its `@param` text.
 * @returns The extracted parameter list.
 */
export function extractCandidateParams(candidate: TaggedExportCandidate, descriptions: ReadonlyMap<string, string>): readonly ExtractedParam[] {
  const params = getCandidateParameters(candidate);
  const out: ExtractedParam[] = [];
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

// MARK: Defaults — slug, category, tag-set
/**
 * Converts an export name into its kebab-case slug form. Handles
 * camelCase (`expirationDetails` → `expiration-details`), PascalCase
 * (`ExpirationDetails` → `expiration-details`), and SCREAMING_SNAKE_CASE
 * (`FIRESTORE_PASSTHROUGH_FIELD` → `firestore-passthrough-field`);
 * already-kebab inputs pass through unchanged.
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

const PROJECT_PREFIX_PATTERNS = ['/src/lib/', '/src/'];

/**
 * Picks a default `category` from a source file path. The category is the
 * first folder beneath `src/lib/` (or `src/` when `src/lib/` isn't
 * present), so `packages/util/src/lib/date/expires.ts` → `date`.
 *
 * @param filePath - The absolute or repo-relative path to the source file.
 * @returns The derived category slug, or `'misc'` when no folder is found.
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

/**
 * Input to {@link buildTagSet}.
 */
export interface BuildTagSetInput {
  readonly name: string;
  readonly slug: string;
  readonly summary: string;
  readonly explicit: readonly string[];
  readonly category: string;
}

/**
 * Builds the deduped, lowercased tag set for a tagged-export entry. Tags
 * are seeded from any `@*Tags` JSDoc body (`explicit`), then the category,
 * the slug pieces, the export name (raw + kebab-cased pieces). When no
 * explicit tags were supplied, up to eight summary-derived tokens are
 * appended so the registry has some matchable text even when the author
 * skipped the explicit tag.
 *
 * @param input - Source pieces to assemble the tag set from.
 * @returns The deduped, lowercased tag list.
 */
export function buildTagSet(input: BuildTagSetInput): readonly string[] {
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
