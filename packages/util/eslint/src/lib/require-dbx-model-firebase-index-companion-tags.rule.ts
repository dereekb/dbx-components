import { getStatementAnchor, leadingJsdocFor } from './comments';
import type { Maybe } from '@dereekb/util';
import { parseJsdocComment } from './jsdoc-parser';
import { buildLowercaseTagsFix, checkDbxTagFamily, findFamilyTags, reportOnJsdocLine, type DbxCompanionTagSpec, type DbxTagFamilySpec } from './dbx-tag-families';

interface AstNode {
  readonly type: string;
  [key: string]: any;
}

const DEFAULT_ALLOWED_SCOPES: readonly string[] = ['COLLECTION', 'COLLECTION_GROUP'];
const DEFAULT_KNOWN_COMPANIONS: readonly string[] = ['Slug', 'Model', 'Scope', 'Dispatcher', 'Manual', 'Skip', 'AllowArrayContainsAny', 'Category', 'Tags', 'Related', 'SkillRefs', 'Path', 'Helper'];

/**
 * Options for the require-dbx-model-firebase-index-companion-tags rule.
 */
export interface UtilRequireDbxModelFirebaseIndexCompanionTagsRuleOptions {
  readonly allowedScopes?: readonly string[];
  readonly knownCompanions?: readonly string[];
  readonly requireBareMarker?: boolean;
}

/**
 * ESLint rule definition for require-dbx-model-firebase-index-companion-tags.
 */
export interface UtilRequireDbxModelFirebaseIndexCompanionTagsRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireDbxModelFirebaseIndexCompanionTagsRuleOptions[]; report: (descriptor: { loc?: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => Maybe<AstNode | AstNode[]> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule enforcing `@dbxModelFirebaseIndex` companion tags. Mirrors the
 * scanner schema at `packages/dbx-components-mcp/src/scan/model-firebase-index-extract.ts`.
 */
export const UTIL_REQUIRE_DBX_MODEL_FIREBASE_INDEX_COMPANION_TAGS_RULE: UtilRequireDbxModelFirebaseIndexCompanionTagsRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require the canonical `@dbxModelFirebaseIndex*` companion tags on `@dbxModelFirebaseIndex`-tagged factories.',
      recommended: true
    },
    messages: {
      missingModel: '`@dbxModelFirebaseIndex`-tagged factory is missing the required `@dbxModelFirebaseIndexModel <ModelName>` companion tag.',
      invalidModelIdentifier: '`@dbxModelFirebaseIndexModel` value `{{value}}` is not a valid PascalCase identifier.',
      invalidScope: '`@dbxModelFirebaseIndexScope` value `{{value}}` is not allowed. Use one of: {{allowed}}.',
      invalidBooleanValue: '`@dbxModelFirebaseIndex{{name}}` value `{{value}}` is not a recognized boolean.',
      slugNotKebab: '`@dbxModelFirebaseIndexSlug` value `{{value}}` is not a valid kebab-case slug.',
      tagsNotLowercase: '`@dbxModelFirebaseIndexTags` token `{{value}}` contains uppercase characters; tokens should be lowercase.',
      relatedNotKebab: '`@dbxModelFirebaseIndexRelated` item `{{value}}` is not a kebab-case slug.',
      skillRefsNotKebab: '`@dbxModelFirebaseIndexSkillRefs` item `{{value}}` is not a kebab-case slug.',
      unknownDbxModelFirebaseIndexTag: '`@dbxModelFirebaseIndex{{name}}` is not a recognized companion tag. Known companions: {{known}}.',
      duplicateCompanionTag: '`@dbxModelFirebaseIndex{{name}}` is declared more than once.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          allowedScopes: { type: 'array' as const, items: { type: 'string' as const } },
          knownCompanions: { type: 'array' as const, items: { type: 'string' as const } },
          requireBareMarker: { type: 'boolean' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const sourceCode = context.sourceCode;
    const allowedScopes = options.allowedScopes ?? DEFAULT_ALLOWED_SCOPES;
    const knownCompanions = options.knownCompanions ?? DEFAULT_KNOWN_COMPANIONS;
    const requireBareMarker = options.requireBareMarker !== false;

    const allCompanions: readonly DbxCompanionTagSpec[] = [
      { suffix: 'Slug', format: { kind: 'kebab-slug' } },
      { suffix: 'Model', required: true, format: { kind: 'pascal-identifier' } },
      { suffix: 'Scope', format: { kind: 'enum', values: allowedScopes } },
      { suffix: 'Dispatcher', format: { kind: 'boolean' } },
      { suffix: 'Manual', format: { kind: 'boolean' } },
      { suffix: 'Skip', format: { kind: 'boolean' } },
      { suffix: 'AllowArrayContainsAny', format: { kind: 'boolean' } },
      { suffix: 'Category', format: { kind: 'free-text' } },
      { suffix: 'Tags', format: { kind: 'comma-list-lowercase' } },
      { suffix: 'Related', format: { kind: 'comma-list-kebab-slug' } },
      { suffix: 'SkillRefs', format: { kind: 'comma-list-kebab-slug' } },
      { suffix: 'Path', multiple: true, format: { kind: 'comma-list-free-text' } },
      { suffix: 'Helper', format: { kind: 'free-text' } }
    ];
    const spec: DbxTagFamilySpec = {
      marker: 'dbxModelFirebaseIndex',
      companions: allCompanions.filter((c) => knownCompanions.includes(c.suffix))
    };

    function handleCommaItem(input: { readonly commentNode: AstNode; readonly parsed: ReturnType<typeof parseJsdocComment>; readonly suffix: string; readonly value: string; readonly lineIndex: number }): void {
      const { commentNode, parsed, suffix, value, lineIndex } = input;
      if (suffix === 'Related') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex, messageId: 'relatedNotKebab', data: { value }, report: context.report });
      else if (suffix === 'SkillRefs') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex, messageId: 'skillRefsNotKebab', data: { value }, report: context.report });
    }

    function handleTagsNotLowercase(commentNode: AstNode, parsed: ReturnType<typeof parseJsdocComment>, v: Extract<Parameters<Parameters<typeof checkDbxTagFamily>[0]['emit']>[0], { kind: 'tags-not-lowercase' }>): void {
      if (v.suffix !== 'Tags') return;
      const fix = buildLowercaseTagsFix({ commentNode, parsed, sourceCode, tag: v.raw });
      const fixer = fix ? (fixer2: AstNode) => fixer2.replaceTextRange([fix.startOffset, fix.endOffset], fix.replacement) : undefined;
      reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'tagsNotLowercase', data: { value: v.value }, report: context.report, fix: fixer });
    }

    function handleViolation(commentNode: AstNode, parsed: ReturnType<typeof parseJsdocComment>, v: Parameters<Parameters<typeof checkDbxTagFamily>[0]['emit']>[0]): void {
      switch (v.kind) {
        case 'missing':
        case 'empty':
          if (v.suffix === 'Model') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'missingModel', report: context.report });
          break;
        case 'invalid-kebab':
          if (v.suffix === 'Slug') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'slugNotKebab', data: { value: v.value }, report: context.report });
          break;
        case 'invalid-pascal':
          if (v.suffix === 'Model') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'invalidModelIdentifier', data: { value: v.value }, report: context.report });
          break;
        case 'invalid-enum':
          if (v.suffix === 'Scope') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'invalidScope', data: { value: v.value, allowed: v.allowed.join(', ') }, report: context.report });
          break;
        case 'invalid-boolean':
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'invalidBooleanValue', data: { name: v.suffix, value: v.value }, report: context.report });
          break;
        case 'comma-item-not-kebab':
          handleCommaItem({ commentNode, parsed, suffix: v.suffix, value: v.value, lineIndex: v.lineIndex });
          break;
        case 'tags-not-lowercase':
          handleTagsNotLowercase(commentNode, parsed, v);
          break;
        case 'unknown':
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'unknownDbxModelFirebaseIndexTag', data: { name: v.suffix, known: knownCompanions.join(', ') }, report: context.report });
          break;
        case 'duplicate':
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'duplicateCompanionTag', data: { name: v.suffix }, report: context.report });
          break;
        default:
          break;
      }
    }

    function checkJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const { markerTag, familyTags } = findFamilyTags(parsed, spec.marker);
      if (familyTags.length === 0 || (requireBareMarker && !markerTag)) return;
      const triggerTag = markerTag ?? familyTags[0];

      checkDbxTagFamily({
        parsed,
        spec,
        markerTag: triggerTag,
        familyTags,
        emit: (v) => handleViolation(commentNode, parsed, v)
      });
    }

    return {
      FunctionDeclaration: (node: AstNode) => {
        if (!node.body) return;
        const jsdoc = leadingJsdocFor(sourceCode, getStatementAnchor(node));
        if (jsdoc) checkJsdoc(jsdoc);
      }
    };
  }
};
