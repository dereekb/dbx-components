import { getStatementAnchor, leadingJsdocFor } from './comments';
import type { Maybe } from '@dereekb/util';
import { parseJsdocComment, type ParsedJsdoc } from './jsdoc-parser';
import { buildLowercaseTagsFix, checkDbxTagFamily, findFamilyTags, reportOnJsdocLine, type DbxCompanionTagSpec, type DbxTagFamilySpec, type DbxTagViolation } from './dbx-tag-families';

interface AstNode {
  readonly type: string;
  [key: string]: any;
}

interface UtilReportContext {
  readonly commentNode: AstNode;
  readonly parsed: ParsedJsdoc;
  readonly sourceCode: AstNode;
  readonly report: (descriptor: { node?: AstNode; loc?: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => Maybe<AstNode | AstNode[]> }) => void;
  readonly knownCompanions: readonly string[];
}

function handleUtilCategoryViolation(ctx: UtilReportContext, v: DbxTagViolation): boolean {
  if (v.suffix !== 'Category') return false;
  switch (v.kind) {
    case 'missing':
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: v.lineIndex, messageId: 'missingCategory', report: ctx.report });
      return false;
    case 'empty':
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: v.lineIndex, messageId: 'emptyCategory', report: ctx.report });
      return false;
    case 'invalid-kebab':
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: v.lineIndex, messageId: 'invalidCategoryFormat', data: { value: v.value }, report: ctx.report });
      return true;
    case 'duplicate':
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: v.lineIndex, messageId: 'multipleCategoryTags', report: ctx.report });
      return false;
    default:
      return false;
  }
}

function handleUtilTagsViolation(ctx: UtilReportContext, v: DbxTagViolation): void {
  if (v.kind !== 'tags-not-lowercase' || v.suffix !== 'Tags') return;
  const fix = buildLowercaseTagsFix({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, tag: v.raw });
  const fixer = fix ? (fixer2: AstNode) => fixer2.replaceTextRange([fix.startOffset, fix.endOffset], fix.replacement) : undefined;
  reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: v.lineIndex, messageId: 'tagsNotLowercase', data: { value: v.value }, report: ctx.report, fix: fixer });
}

function handleUtilViolation(ctx: UtilReportContext, v: DbxTagViolation): boolean {
  if (v.suffix === 'Category') {
    return handleUtilCategoryViolation(ctx, v);
  }
  switch (v.kind) {
    case 'invalid-enum':
      if (v.suffix === 'Kind') {
        reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: v.lineIndex, messageId: 'invalidKind', data: { value: v.value, allowed: v.allowed.join(', ') }, report: ctx.report });
      }
      break;
    case 'comma-item-not-kebab':
      if (v.suffix === 'Related') {
        reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: v.lineIndex, messageId: 'relatedNotKebab', data: { value: v.value }, report: ctx.report });
      }
      break;
    case 'tags-not-lowercase':
      handleUtilTagsViolation(ctx, v);
      break;
    case 'unknown':
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: v.lineIndex, messageId: 'unknownDbxUtilTag', data: { name: v.suffix, known: ctx.knownCompanions.join(', ') }, report: ctx.report });
      break;
    case 'duplicate':
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: v.lineIndex, messageId: 'duplicateCompanionTag', data: { name: v.suffix }, report: ctx.report });
      break;
    default:
      break;
  }
  return false;
}

function reportUtilViolations(ctx: UtilReportContext, violations: readonly DbxTagViolation[]): boolean {
  let kebabFailedForCategory = false;
  for (const v of violations) {
    if (handleUtilViolation(ctx, v)) {
      kebabFailedForCategory = true;
    }
  }
  return kebabFailedForCategory;
}

function reportUtilAllowedCategory(ctx: UtilReportContext, familyTags: readonly { readonly tag: string; readonly description: string; readonly startLineIndex: number }[], allowedCategories: readonly string[]): void {
  const categoryTags = familyTags.filter((t) => t.tag === 'dbxUtilCategory');
  if (categoryTags.length === 0) return;
  const first = categoryTags[0];
  const value = first.description.trim();
  if (value.length === 0 || allowedCategories.includes(value)) return;
  reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: first.startLineIndex, messageId: 'invalidCategoryFormat', data: { value }, report: ctx.report });
}

/**
 * Default companion-tag names recognized in the `@dbxUtil` family. The names exclude the
 * `dbxUtil` prefix (so `@dbxUtilCategory` is represented as `'Category'`).
 */
const DEFAULT_KNOWN_COMPANIONS: readonly string[] = ['Category', 'Kind', 'Tags', 'Related'];

/**
 * Allowed values for `@dbxUtilKind`. Mirrors the enum in
 * `packages/dbx-components-mcp/src/scan/utils-extract.ts`.
 */
const DEFAULT_ALLOWED_KINDS: readonly string[] = ['function', 'class', 'const', 'factory'];

/**
 * Options for the require-dbx-util-companion-tags rule.
 */
export interface UtilRequireDbxUtilCompanionTagsRuleOptions {
  /**
   * When provided, `@dbxUtilCategory` values must be in this list. When omitted, any kebab-case
   * slug is accepted.
   */
  readonly allowedCategories?: readonly string[];
  /**
   * Override the set of values accepted for `@dbxUtilKind`. Defaults to `['function', 'class', 'const', 'factory']`.
   */
  readonly allowedKinds?: readonly string[];
  /**
   * Override the companion-tag whitelist (without the `dbxUtil` prefix). Defaults to `['Category', 'Kind', 'Tags', 'Related']`.
   */
  readonly knownCompanions?: readonly string[];
  /**
   * When true (default), only the bare `@dbxUtil` tag triggers the rule. When false, any
   * `@dbxUtil*` tag triggers it (useful for partial-block detection).
   */
  readonly requireBareMarker?: boolean;
}

/**
 * ESLint rule definition for require-dbx-util-companion-tags.
 */
export interface UtilRequireDbxUtilCompanionTagsRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireDbxUtilCompanionTagsRuleOptions[]; report: (descriptor: { node?: AstNode; loc?: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => Maybe<AstNode | AstNode[]> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule enforcing that exports tagged `@dbxUtil` carry the registry-required companion tags
 * with valid value formats. Mirrors the scanner schema at
 * `packages/dbx-components-mcp/src/scan/utils-extract.ts` so violations surface at lint time
 * instead of at manifest-regeneration time.
 *
 * Checks:
 *
 * - `@dbxUtilCategory` is present (required) with a kebab-case slug value.
 * - `@dbxUtilKind` (optional) has a value from the configured enum.
 * - `@dbxUtilRelated` (optional) items are all kebab-case slugs.
 * - `@dbxUtilTags` (optional) tokens are all lowercase.
 * - Unknown `@dbxUtil*` tags (typos like `@dbxUtilCateogry`) are flagged.
 * - Companion tags appear at most once each.
 *
 * Only the `@dbxUtilTags` lowercase fix is auto-applied. Category, kind, and related-slug
 * violations are report-only — they require human / agent judgment on the correct value.
 */
export const utilRequireDbxUtilCompanionTagsRule: UtilRequireDbxUtilCompanionTagsRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require the `@dbxUtilCategory` companion tag and validate other `@dbxUtil*` tag values when `@dbxUtil` is present.',
      recommended: true
    },
    messages: {
      missingCategory: '`@dbxUtil`-tagged export is missing the required `@dbxUtilCategory <slug>` companion tag. Add it on the next line.',
      emptyCategory: '`@dbxUtilCategory` requires a non-empty kebab-case slug value.',
      invalidCategoryFormat: '`@dbxUtilCategory` value `{{value}}` is not a valid kebab-case slug (e.g. `boolean`, `date-range`).',
      multipleCategoryTags: '`@dbxUtilCategory` appears more than once; only one category is allowed.',
      invalidKind: '`@dbxUtilKind` value `{{value}}` is not allowed. Use one of: {{allowed}}.',
      relatedNotKebab: '`@dbxUtilRelated` item `{{value}}` is not a kebab-case slug. Use slugs (e.g. `read-keys-function`), not camelCase identifiers.',
      tagsNotLowercase: '`@dbxUtilTags` token `{{value}}` contains uppercase characters; tokens should be lowercase.',
      unknownDbxUtilTag: '`@dbxUtil{{name}}` is not a recognized companion tag. Known companions: {{known}}.',
      duplicateCompanionTag: '`@dbxUtil{{name}}` is declared more than once.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          allowedCategories: { type: 'array' as const, items: { type: 'string' as const } },
          allowedKinds: { type: 'array' as const, items: { type: 'string' as const } },
          knownCompanions: { type: 'array' as const, items: { type: 'string' as const } },
          requireBareMarker: { type: 'boolean' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const sourceCode = context.sourceCode;
    const allowedCategories = options.allowedCategories;
    const allowedKinds = options.allowedKinds ?? DEFAULT_ALLOWED_KINDS;
    const knownCompanions = options.knownCompanions ?? DEFAULT_KNOWN_COMPANIONS;
    const requireBareMarker = options.requireBareMarker !== false;

    const allCompanions: readonly DbxCompanionTagSpec[] = [
      { suffix: 'Category', required: true, format: { kind: 'kebab-slug' } },
      { suffix: 'Kind', format: { kind: 'enum', values: allowedKinds } },
      { suffix: 'Tags', format: { kind: 'comma-list-lowercase' } },
      { suffix: 'Related', format: { kind: 'comma-list-kebab-slug' } }
    ];
    const spec: DbxTagFamilySpec = {
      marker: 'dbxUtil',
      companions: allCompanions.filter((c) => knownCompanions.includes(c.suffix))
    };

    function checkJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const { markerTag, familyTags } = findFamilyTags(parsed, spec.marker);
      if (familyTags.length === 0 || (requireBareMarker && !markerTag)) return;
      const triggerTag = markerTag ?? familyTags[0];

      const violations: DbxTagViolation[] = [];
      checkDbxTagFamily({ parsed, spec, markerTag: triggerTag, familyTags, emit: (v) => violations.push(v) });

      const ctx: UtilReportContext = { commentNode, parsed, sourceCode, report: context.report, knownCompanions };
      const kebabFailedForCategory = reportUtilViolations(ctx, violations);

      // Apply the allowedCategories option on top of the kebab-format result.
      // Skipped when the kebab check already flagged the category — the original
      // semantics used `else if` so only one invalidCategoryFormat fires.
      if (allowedCategories && !kebabFailedForCategory) {
        reportUtilAllowedCategory(ctx, familyTags, allowedCategories);
      }
    }

    function visit(node: AstNode, anchorParentTypes: readonly string[]): void {
      const anchor = node.parent && anchorParentTypes.includes(node.parent.type) ? node.parent : node;
      const jsdoc = leadingJsdocFor(sourceCode, anchor);
      if (jsdoc) checkJsdoc(jsdoc);
    }

    const exportAnchors: readonly string[] = ['ExportNamedDeclaration', 'ExportDefaultDeclaration'];

    return {
      FunctionDeclaration: (node: AstNode) => {
        if (!node.body) return;
        const jsdoc = leadingJsdocFor(sourceCode, getStatementAnchor(node));
        if (jsdoc) checkJsdoc(jsdoc);
      },
      VariableDeclaration: (node: AstNode) => visit(node, exportAnchors),
      ClassDeclaration: (node: AstNode) => visit(node, exportAnchors),
      TSInterfaceDeclaration: (node: AstNode) => visit(node, exportAnchors),
      TSTypeAliasDeclaration: (node: AstNode) => visit(node, exportAnchors)
    };
  }
};
