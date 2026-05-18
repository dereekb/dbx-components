/**
 * Shared helpers for the `@dbx<Family>` companion-tag ESLint rules. Mirrors the
 * scanner schemas in `packages/dbx-components-mcp/src/scan/*-extract.ts` so
 * violations surface at lint time instead of at manifest-regeneration time.
 *
 * Each per-family rule supplies a {@link DbxTagFamilySpec} describing which
 * companions are required/optional, what value format each accepts, and which
 * messageId to emit when a check fails. The rule body itself only wires the
 * visitors and message map; all value-format validation lives here.
 */

import type { Maybe } from '@dereekb/util';
import { type ParsedJsdoc, type ParsedJsdocTag } from './jsdoc-parser';

interface AstNode {
  readonly type: string;
  [key: string]: any;
}

/**
 * Kebab-case slug pattern: lowercase letters/digits, words separated by single hyphens,
 * starts with a letter. Used to validate slug/related/skill-ref values.
 */
export const KEBAB_SLUG_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Pascal-case TypeScript identifier pattern (starts uppercase). Used for model
 * identifiers and other `<ModelName>` style tag values.
 */
export const PASCAL_IDENTIFIER_PATTERN = /^[A-Z][A-Za-z0-9_$]*$/;

/**
 * Boolean tag-value vocabulary (case-insensitive). `''` and `true|yes` map to
 * true; `false|no` map to false. Anything else is flagged as invalid.
 */
const TRUE_TAG_VALUES: ReadonlySet<string> = new Set(['', 'true', 'yes']);
const FALSE_TAG_VALUES: ReadonlySet<string> = new Set(['false', 'no']);

/**
 * Discriminated description of how a companion tag's value should be parsed
 * and validated. The shared checker dispatches on `kind`.
 */
export type DbxTagFormat = { readonly kind: 'marker' } | { readonly kind: 'kebab-slug' } | { readonly kind: 'enum'; readonly values: readonly string[] } | { readonly kind: 'pascal-identifier' } | { readonly kind: 'comma-list-kebab-slug' } | { readonly kind: 'comma-list-lowercase' } | { readonly kind: 'comma-list-free-text' } | { readonly kind: 'free-text' } | { readonly kind: 'boolean' };

/**
 * One companion-tag spec entry. `suffix` is appended to the family marker name
 * to form the full tag (e.g. `dbxPipe` + `Slug` → `@dbxPipeSlug`).
 */
export interface DbxCompanionTagSpec {
  readonly suffix: string;
  readonly required?: boolean;
  readonly multiple?: boolean;
  readonly format: DbxTagFormat;
}

/**
 * The full set of companions plus the marker that triggers a family rule.
 */
export interface DbxTagFamilySpec {
  readonly marker: string;
  readonly companions: readonly DbxCompanionTagSpec[];
}

/**
 * One violation emitted by {@link checkDbxTagFamily}. Each rule's `meta.messages`
 * map provides the message text for each `kind`.
 */
export type DbxTagViolation =
  | { readonly kind: 'missing'; readonly suffix: string; readonly lineIndex: number }
  | { readonly kind: 'empty'; readonly suffix: string; readonly lineIndex: number }
  | { readonly kind: 'invalid-kebab'; readonly suffix: string; readonly value: string; readonly lineIndex: number }
  | { readonly kind: 'invalid-enum'; readonly suffix: string; readonly value: string; readonly allowed: readonly string[]; readonly lineIndex: number }
  | { readonly kind: 'invalid-pascal'; readonly suffix: string; readonly value: string; readonly lineIndex: number }
  | { readonly kind: 'invalid-boolean'; readonly suffix: string; readonly value: string; readonly lineIndex: number }
  | { readonly kind: 'comma-item-not-kebab'; readonly suffix: string; readonly value: string; readonly lineIndex: number }
  | { readonly kind: 'tags-not-lowercase'; readonly suffix: string; readonly value: string; readonly lineIndex: number; readonly raw: ParsedJsdocTag }
  | { readonly kind: 'unknown'; readonly suffix: string; readonly lineIndex: number }
  | { readonly kind: 'duplicate'; readonly suffix: string; readonly lineIndex: number };

/**
 * Splits a comma-separated tag-value string into trimmed items, preserving order.
 *
 * @param value - Raw text following the tag name on a single line.
 * @returns Non-empty trimmed segments in declaration order.
 */
export function splitCommaSeparated(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Parses a boolean tag value using the workspace vocabulary
 * (`''`/`true`/`yes` → true; `false`/`no` → false). Other inputs return `undefined`.
 *
 * @param text - The trimmed tag value text.
 * @returns The parsed boolean, or `undefined` when the text is not in the vocabulary.
 */
export function parseBooleanTagValue(text: string): Maybe<boolean> {
  const lowered = text.trim().toLowerCase();
  let result: Maybe<boolean>;
  if (TRUE_TAG_VALUES.has(lowered)) {
    result = true;
  } else if (FALSE_TAG_VALUES.has(lowered)) {
    result = false;
  }
  return result;
}

/**
 * Returns the source-text offset of an offset-within-comment-value, given a Block comment node.
 *
 * @param commentNode - The ESLint Block comment AST node.
 * @param valueOffset - The character offset within `comment.value`.
 * @returns The character offset in the source file.
 */
export function commentValueToSourceOffset(commentNode: AstNode, valueOffset: number): number {
  return commentNode.range[0] + 2 + valueOffset;
}

/**
 * Returns the family marker + companion tag list for the given parsed JSDoc.
 * Family membership is determined by tag-name prefix.
 *
 * @param parsed - The parsed JSDoc.
 * @param marker - The bare family marker (e.g. `'dbxPipe'`).
 * @returns The marker tag (if present), and all companion tags in source order.
 */
export function findFamilyTags(parsed: ParsedJsdoc, marker: string): { readonly markerTag: Maybe<ParsedJsdocTag>; readonly familyTags: readonly ParsedJsdocTag[] } {
  const familyTags = parsed.tags.filter((t) => t.tag === marker || t.tag.startsWith(marker));
  const markerTag = parsed.tags.find((t) => t.tag === marker);
  return { markerTag, familyTags };
}

/**
 * Groups companion tags (those after the marker) by suffix. Marker entries are excluded.
 *
 * @param familyTags - The family tag list from {@link findFamilyTags}.
 * @param marker - The bare family marker.
 * @returns Lookup keyed by companion-suffix listing matching tags in declaration order.
 */
export function groupCompanionsBySuffix(familyTags: readonly ParsedJsdocTag[], marker: string): Map<string, ParsedJsdocTag[]> {
  const result = new Map<string, ParsedJsdocTag[]>();
  for (const tag of familyTags) {
    if (tag.tag === marker) continue;
    const suffix = tag.tag.slice(marker.length);
    const list = result.get(suffix) ?? [];
    list.push(tag);
    result.set(suffix, list);
  }
  return result;
}

/**
 * Per-format validators dispatched from {@link validateNonEmptyValue}. Each entry validates
 * a single non-empty tag value and emits zero or more violations.
 */
const VALUE_VALIDATORS: Record<DbxTagFormat['kind'], (spec: DbxCompanionTagSpec, tag: ParsedJsdocTag, value: string, lineIndex: number, emit: (v: DbxTagViolation) => void) => void> = {
  marker: () => undefined,
  'free-text': () => undefined,
  'comma-list-free-text': () => undefined,
  'kebab-slug': (spec, _tag, value, lineIndex, emit) => {
    if (!KEBAB_SLUG_PATTERN.test(value)) emit({ kind: 'invalid-kebab', suffix: spec.suffix, value, lineIndex });
  },
  enum: (spec, _tag, value, lineIndex, emit) => {
    const format = spec.format as { readonly kind: 'enum'; readonly values: readonly string[] };
    if (!format.values.includes(value)) emit({ kind: 'invalid-enum', suffix: spec.suffix, value, allowed: format.values, lineIndex });
  },
  'pascal-identifier': (spec, _tag, value, lineIndex, emit) => {
    if (!PASCAL_IDENTIFIER_PATTERN.test(value)) emit({ kind: 'invalid-pascal', suffix: spec.suffix, value, lineIndex });
  },
  'comma-list-kebab-slug': (spec, _tag, value, lineIndex, emit) => {
    for (const item of splitCommaSeparated(value)) {
      if (!KEBAB_SLUG_PATTERN.test(item)) emit({ kind: 'comma-item-not-kebab', suffix: spec.suffix, value: item, lineIndex });
    }
  },
  'comma-list-lowercase': (spec, tag, value, lineIndex, emit) => {
    for (const item of splitCommaSeparated(value)) {
      if (/[A-Z]/.test(item)) emit({ kind: 'tags-not-lowercase', suffix: spec.suffix, value: item, lineIndex, raw: tag });
    }
  },
  boolean: (spec, _tag, value, lineIndex, emit) => {
    if (parseBooleanTagValue(value) === undefined) emit({ kind: 'invalid-boolean', suffix: spec.suffix, value, lineIndex });
  }
};

/**
 * Validates one companion tag's value against the configured {@link DbxTagFormat}
 * and emits zero-or-more violations. Used by {@link checkDbxTagFamily} to keep
 * each rule's body small.
 *
 * @param spec - The companion spec being validated.
 * @param tags - All occurrences of the companion in source order.
 * @param emit - Callback for each violation.
 */
function validateCompanionValue(spec: DbxCompanionTagSpec, tags: readonly ParsedJsdocTag[], emit: (v: DbxTagViolation) => void): void {
  if (spec.format.kind === 'marker') return;
  for (const tag of tags) {
    const value = tag.description.trim();
    const lineIndex = tag.startLineIndex;
    if (value.length === 0) {
      if (spec.format.kind !== 'boolean') emit({ kind: 'empty', suffix: spec.suffix, lineIndex });
      continue;
    }
    const validator = VALUE_VALIDATORS[spec.format.kind];
    if (validator) validator(spec, tag, value, lineIndex, emit);
  }
}

/**
 * Runs the canonical companion-tag validation pass for a `@dbx<Family>`-tagged
 * JSDoc against the supplied {@link DbxTagFamilySpec}. Emits one
 * {@link DbxTagViolation} per finding via `emit`; the calling rule maps each
 * violation to its own messageId.
 *
 * Validation pass order:
 *
 *   1. Unknown companions (typo detection — companions not in the spec).
 *   2. Required companions present (one violation per missing required tag).
 *   3. Duplicates (companion appears more than once, when `multiple` is not set).
 *   4. Per-companion value-format validation.
 *
 * Marker presence is the caller's responsibility — pass `markerPresent=true`
 * (i.e. `requireBareMarker` already satisfied) before invoking this.
 */
export interface CheckDbxTagFamilyInput {
  readonly parsed: ParsedJsdoc;
  readonly spec: DbxTagFamilySpec;
  readonly markerTag: ParsedJsdocTag;
  readonly familyTags: readonly ParsedJsdocTag[];
  readonly emit: (violation: DbxTagViolation) => void;
}

/**
 * Validates a `@dbx<Family>` marker plus its companion tags against the supplied spec.
 * Reports unknown companions, missing required companions, duplicates, and per-companion
 * value violations through `input.emit`.
 *
 * @param input - Parsed JSDoc, family spec, resolved marker/companion tags, and emit sink.
 *
 * @example
 * ```ts
 * checkDbxTagFamily({ parsed, spec, markerTag, familyTags, emit });
 * ```
 */
function emitUnknownCompanions(groups: Map<string, ParsedJsdocTag[]>, knownSuffixes: ReadonlySet<string>, emit: (v: DbxTagViolation) => void): void {
  for (const [suffix, instances] of groups.entries()) {
    if (knownSuffixes.has(suffix)) continue;
    for (const tag of instances) emit({ kind: 'unknown', suffix, lineIndex: tag.startLineIndex });
  }
}

function emitDuplicateCompanions(companion: DbxCompanionTagSpec, instances: readonly ParsedJsdocTag[], emit: (v: DbxTagViolation) => void): void {
  for (let i = 1; i < instances.length; i += 1) {
    emit({ kind: 'duplicate', suffix: companion.suffix, lineIndex: instances[i].startLineIndex });
  }
}

function checkCompanion(companion: DbxCompanionTagSpec, instances: readonly ParsedJsdocTag[], markerLineIndex: number, emit: (v: DbxTagViolation) => void): void {
  if (instances.length === 0) {
    if (companion.required) emit({ kind: 'missing', suffix: companion.suffix, lineIndex: markerLineIndex });
    return;
  }
  if (!companion.multiple && instances.length > 1) emitDuplicateCompanions(companion, instances, emit);
  validateCompanionValue(companion, instances, emit);
}

export function checkDbxTagFamily(input: CheckDbxTagFamilyInput): void {
  const { spec, markerTag, familyTags, emit } = input;
  const knownSuffixes = new Set(spec.companions.map((c) => c.suffix));
  const groups = groupCompanionsBySuffix(familyTags, spec.marker);

  emitUnknownCompanions(groups, knownSuffixes, emit);

  for (const companion of spec.companions) {
    const instances = groups.get(companion.suffix) ?? [];
    checkCompanion(companion, instances, markerTag.startLineIndex, emit);
  }
}

/**
 * Wraps `context.report` with the family rule's common "report on a tag line"
 * helper. The shared rule body uses this to translate {@link DbxTagViolation}
 * locations into ESLint source ranges.
 */
export interface ReportOnLineInput {
  readonly commentNode: AstNode;
  readonly parsed: ParsedJsdoc;
  readonly sourceCode: AstNode;
  readonly lineIndex: number;
  readonly messageId: string;
  readonly data?: Record<string, string>;
  readonly report: (descriptor: { loc: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => Maybe<AstNode | AstNode[]> }) => void;
  readonly fix?: (fixer: AstNode) => Maybe<AstNode | AstNode[]>;
}

/**
 * Translates a JSDoc-line violation into an ESLint `context.report()` call by computing the
 * source range of the offending line and attaching the supplied message + optional fixer.
 *
 * @param input - Reporting context (comment node, parsed JSDoc, source code, line index, message id, optional data + fixer, report sink).
 *
 * @example
 * ```ts
 * reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'unknown', report: context.report });
 * ```
 */
export function reportOnJsdocLine(input: ReportOnLineInput): void {
  const { commentNode, parsed, sourceCode, lineIndex, messageId, data, report, fix } = input;
  const line = parsed.lines[lineIndex];
  const startInValue = line?.textOffsetStart ?? 0;
  const endInValue = startInValue + (line?.text?.length ?? 0);
  const start = commentValueToSourceOffset(commentNode, startInValue);
  const end = commentValueToSourceOffset(commentNode, endInValue);
  report({
    loc: {
      start: sourceCode.getLocFromIndex(start),
      end: sourceCode.getLocFromIndex(end)
    },
    messageId,
    data,
    fix
  });
}

/**
 * The visitor scopes used by `@dbx<Family>` companion-tag rules. Each rule
 * supplies a subset and the shared visitor wires them with the canonical
 * `getStatementAnchor` / `leadingJsdocFor` logic.
 */
export type DbxFamilyVisitorKind = 'FunctionDeclaration' | 'VariableDeclaration' | 'ClassDeclaration' | 'TSInterfaceDeclaration' | 'TSTypeAliasDeclaration' | 'TSEnumDeclaration' | 'TSPropertySignature' | 'PropertyDefinition' | 'TSEnumMember';

/**
 * Callback that maps a {@link DbxTagViolation} to its rule-specific
 * messageId + data, or `null` when the violation should be silently dropped
 * (e.g. when the rule does not require the missing companion).
 */
export type DbxFamilyViolationMapper = (violation: DbxTagViolation) => Maybe<{ readonly messageId: string; readonly data?: Record<string, string>; readonly fixable?: boolean }>;

/**
 * Produces an auto-fix for a `@dbx<Family>Tags ...` line that lowercases every
 * token after the tag name. Returns the replacement source range + text, or
 * `undefined` when the line is already canonical.
 *
 * @param input - The fix context (comment node, parsed JSDoc, source code, tag).
 * @returns The replacement range/text, or `undefined` when no fix is needed.
 */
export interface BuildLowercaseTagsFixInput {
  readonly commentNode: AstNode;
  readonly parsed: ParsedJsdoc;
  readonly sourceCode: AstNode;
  readonly tag: ParsedJsdocTag;
}

export interface LowercaseTagsFixResult {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly replacement: string;
}

/**
 * Computes an auto-fix descriptor that lowercases every token after a `@dbx<Family>Tags` tag
 * name. Returns `undefined` when the line is already canonical so the caller can short-circuit.
 *
 * @param input - Fix context (comment node, parsed JSDoc, source code, target tag).
 * @returns Replacement range + text when a rewrite is needed; otherwise `undefined`.
 *
 * @example
 * ```ts
 * const fix = buildLowercaseTagsFix({ commentNode, parsed, sourceCode, tag });
 * ```
 */
export function buildLowercaseTagsFix(input: BuildLowercaseTagsFixInput): Maybe<LowercaseTagsFixResult> {
  const { commentNode, parsed, sourceCode, tag } = input;
  const tagLine = parsed.lines[tag.startLineIndex];
  let result: Maybe<LowercaseTagsFixResult>;
  if (tagLine) {
    const tagLineSourceStart = commentValueToSourceOffset(commentNode, tagLine.textOffsetStart);
    const tagLineSourceEnd = tagLineSourceStart + tagLine.text.length;
    const sourceText = sourceCode.getText();
    const lineSource = sourceText.slice(tagLineSourceStart, tagLineSourceEnd);
    const lowered = lineSource.replace(/^(@[A-Za-z]+\s+)(.*)$/, (_match: string, prefix: string, body: string) => `${prefix}${body.toLowerCase()}`);
    if (lowered !== lineSource) {
      result = { startOffset: tagLineSourceStart, endOffset: tagLineSourceEnd, replacement: lowered };
    }
  }
  return result;
}
