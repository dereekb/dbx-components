import { getStatementAnchor } from './comments';
import { parseJsdocComment, type ParsedJsdoc, type ParsedJsdocTag } from './jsdoc-parser';

type AstNode = any;

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
 * Kebab-case slug pattern: lowercase letters and digits, words separated by single hyphens,
 * starts with a letter. Used to validate `@dbxUtilCategory` and `@dbxUtilRelated` values.
 */
const KEBAB_SLUG_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

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
  create(context: { options: UtilRequireDbxUtilCompanionTagsRuleOptions[]; report: (descriptor: { node?: AstNode; loc?: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => AstNode | AstNode[] | null }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * Returns the source-text offset of an offset-within-comment-value, given a Block comment node.
 *
 * @param commentNode - The ESLint Block comment AST node.
 * @param valueOffset - The character offset within `comment.value`.
 * @returns The character offset in the source file.
 */
function commentValueToSourceOffset(commentNode: AstNode, valueOffset: number): number {
  return commentNode.range[0] + 2 + valueOffset;
}

/**
 * Splits a comma-separated tag-value string into trimmed items, preserving order.
 *
 * @param value - The raw text after the tag name on a single line.
 * @returns An array of non-empty trimmed items.
 *
 * @example
 * ```ts
 * splitCommaSeparated('boolean, array, reduce'); // ['boolean', 'array', 'reduce']
 * splitCommaSeparated('  '); // []
 * ```
 */
function splitCommaSeparated(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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

    function reportOnLine(commentNode: AstNode, parsed: ParsedJsdoc, lineIndex: number, messageId: string, data?: Record<string, string>, fix?: (fixer: AstNode) => AstNode | AstNode[] | null): void {
      const line = parsed.lines[lineIndex];
      const startInValue = line?.textOffsetStart ?? 0;
      const endInValue = startInValue + (line?.text?.length ?? 0);
      const start = commentValueToSourceOffset(commentNode, startInValue);
      const end = commentValueToSourceOffset(commentNode, endInValue);
      context.report({
        loc: {
          start: sourceCode.getLocFromIndex(start),
          end: sourceCode.getLocFromIndex(end)
        },
        messageId,
        data,
        fix
      });
    }

    function dbxUtilFamilyTags(parsed: ParsedJsdoc): readonly ParsedJsdocTag[] {
      return parsed.tags.filter((t) => t.tag === 'dbxUtil' || t.tag.startsWith('dbxUtil'));
    }

    function checkJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const family = dbxUtilFamilyTags(parsed);
      if (family.length === 0) return;

      const markerTag = parsed.tags.find((t) => t.tag === 'dbxUtil');
      if (requireBareMarker && !markerTag) return;
      const triggerTag = markerTag ?? family[0];

      const companionByName = new Map<string, ParsedJsdocTag[]>();
      for (const tag of family) {
        if (tag.tag === 'dbxUtil') continue;
        const companionName = tag.tag.slice('dbxUtil'.length);
        const list = companionByName.get(companionName) ?? [];
        list.push(tag);
        companionByName.set(companionName, list);
      }

      // Unknown companions.
      for (const [companionName, instances] of companionByName.entries()) {
        if (!knownCompanions.includes(companionName)) {
          for (const tag of instances) {
            reportOnLine(commentNode, parsed, tag.startLineIndex, 'unknownDbxUtilTag', { name: companionName, known: knownCompanions.join(', ') });
          }
        }
      }

      // Duplicates.
      for (const [companionName, instances] of companionByName.entries()) {
        if (companionName === 'Category') continue; // reported separately as multipleCategoryTags
        if (instances.length > 1) {
          for (let i = 1; i < instances.length; i += 1) {
            reportOnLine(commentNode, parsed, instances[i].startLineIndex, 'duplicateCompanionTag', { name: companionName });
          }
        }
      }

      // Category presence + format.
      const categoryTags = companionByName.get('Category') ?? [];
      if (categoryTags.length === 0) {
        reportOnLine(commentNode, parsed, triggerTag.startLineIndex, 'missingCategory');
      } else {
        if (categoryTags.length > 1) {
          for (let i = 1; i < categoryTags.length; i += 1) {
            reportOnLine(commentNode, parsed, categoryTags[i].startLineIndex, 'multipleCategoryTags');
          }
        }
        const value = categoryTags[0].description.trim();
        if (value.length === 0) {
          reportOnLine(commentNode, parsed, categoryTags[0].startLineIndex, 'emptyCategory');
        } else if (!KEBAB_SLUG_PATTERN.test(value)) {
          reportOnLine(commentNode, parsed, categoryTags[0].startLineIndex, 'invalidCategoryFormat', { value });
        } else if (allowedCategories && !allowedCategories.includes(value)) {
          reportOnLine(commentNode, parsed, categoryTags[0].startLineIndex, 'invalidCategoryFormat', { value });
        }
      }

      // Kind enum.
      const kindTags = companionByName.get('Kind') ?? [];
      for (const tag of kindTags) {
        const value = tag.description.trim();
        if (value.length > 0 && !allowedKinds.includes(value)) {
          reportOnLine(commentNode, parsed, tag.startLineIndex, 'invalidKind', { value, allowed: allowedKinds.join(', ') });
        }
      }

      // Related slugs.
      const relatedTags = companionByName.get('Related') ?? [];
      for (const tag of relatedTags) {
        const items = splitCommaSeparated(tag.description);
        for (const item of items) {
          if (!KEBAB_SLUG_PATTERN.test(item)) {
            reportOnLine(commentNode, parsed, tag.startLineIndex, 'relatedNotKebab', { value: item });
          }
        }
      }

      // Tags lowercase — fixable: lowercase the offending tokens on the tag line.
      const tagsTags = companionByName.get('Tags') ?? [];
      for (const tag of tagsTags) {
        const items = splitCommaSeparated(tag.description);
        const hasUppercase = items.some((item) => /[A-Z]/.test(item));
        if (!hasUppercase) continue;

        const tagLine = parsed.lines[tag.startLineIndex];
        const tagLineSourceStart = commentValueToSourceOffset(commentNode, tagLine.textOffsetStart);
        const tagLineSourceEnd = tagLineSourceStart + tagLine.text.length;
        const sourceText = sourceCode.getText();
        const lineSource = sourceText.slice(tagLineSourceStart, tagLineSourceEnd);
        const lowered = lineSource.replace(/(@dbxUtilTags\s+)(.*)$/, (_match: string, prefix: string, body: string) => `${prefix}${body.toLowerCase()}`);

        for (const item of items) {
          if (/[A-Z]/.test(item)) {
            context.report({
              loc: {
                start: sourceCode.getLocFromIndex(tagLineSourceStart),
                end: sourceCode.getLocFromIndex(tagLineSourceEnd)
              },
              messageId: 'tagsNotLowercase',
              data: { value: item },
              fix: lowered === lineSource ? undefined : (fixer: AstNode) => fixer.replaceTextRange([tagLineSourceStart, tagLineSourceEnd], lowered)
            });
          }
        }
      }
    }

    function leadingJsdocFor(anchor: AstNode): AstNode | null {
      const comments: AstNode[] = sourceCode.getCommentsBefore(anchor) || [];
      let result: AstNode | null = null;

      for (const comment of comments) {
        if (comment.type === 'Block' && typeof comment.value === 'string' && comment.value.startsWith('*')) {
          result = comment;
        }
      }

      return result;
    }

    function visitFunctionDeclaration(node: AstNode): void {
      if (!node.body) return;
      const jsdoc = leadingJsdocFor(getStatementAnchor(node));
      if (jsdoc) checkJsdoc(jsdoc);
    }

    function visitVariableDeclaration(node: AstNode): void {
      const anchor = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
      const jsdoc = leadingJsdocFor(anchor);
      if (jsdoc) checkJsdoc(jsdoc);
    }

    function visitClassDeclaration(node: AstNode): void {
      const anchor = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
      const jsdoc = leadingJsdocFor(anchor);
      if (jsdoc) checkJsdoc(jsdoc);
    }

    function visitInterfaceDeclaration(node: AstNode): void {
      const anchor = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
      const jsdoc = leadingJsdocFor(anchor);
      if (jsdoc) checkJsdoc(jsdoc);
    }

    function visitTypeAlias(node: AstNode): void {
      const anchor = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
      const jsdoc = leadingJsdocFor(anchor);
      if (jsdoc) checkJsdoc(jsdoc);
    }

    return {
      FunctionDeclaration: visitFunctionDeclaration,
      VariableDeclaration: visitVariableDeclaration,
      ClassDeclaration: visitClassDeclaration,
      TSInterfaceDeclaration: visitInterfaceDeclaration,
      TSTypeAliasDeclaration: visitTypeAlias
    };
  }
};
