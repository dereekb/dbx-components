import { leadingJsdocFor } from './comments';
import { parseJsdocComment } from './jsdoc-parser';
import { checkDbxTagFamily, findFamilyTags, reportOnJsdocLine, type DbxCompanionTagSpec, type DbxTagFamilySpec } from './dbx-tag-families';

type AstNode = any;

const DEFAULT_ALLOWED_CATEGORIES: readonly string[] = ['layout', 'list', 'button', 'card', 'feedback', 'overlay', 'navigation', 'text', 'screen', 'action', 'router', 'misc'];
const DEFAULT_KNOWN_COMPANIONS: readonly string[] = ['Slug', 'Category', 'Summary', 'Related', 'AppRef', 'SkillRefs', 'Uses'];

/**
 * Options for the require-dbx-docs-ui-example-companion-tags rule.
 */
export interface UtilRequireDbxDocsUiExampleCompanionTagsRuleOptions {
  readonly allowedCategories?: readonly string[];
  readonly knownCompanions?: readonly string[];
  readonly requireBareMarker?: boolean;
}

/**
 * ESLint rule definition for require-dbx-docs-ui-example-companion-tags.
 */
export interface UtilRequireDbxDocsUiExampleCompanionTagsRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireDbxDocsUiExampleCompanionTagsRuleOptions[]; report: (descriptor: { loc?: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule enforcing `@dbxDocsUiExample` companion tags. Mirrors the
 * scanner schema at `packages/dbx-components-mcp/src/scan/dbx-docs-ui-examples-extract.ts`.
 */
export const utilRequireDbxDocsUiExampleCompanionTagsRule: UtilRequireDbxDocsUiExampleCompanionTagsRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require the canonical `@dbxDocsUiExample*` companion tags on `@dbxDocsUiExample`-tagged classes.',
      recommended: true
    },
    messages: {
      missingSlug: '`@dbxDocsUiExample`-tagged class is missing the required `@dbxDocsUiExampleSlug <slug>` companion tag.',
      missingCategory: '`@dbxDocsUiExample`-tagged class is missing the required `@dbxDocsUiExampleCategory` companion tag.',
      missingSummary: '`@dbxDocsUiExample`-tagged class is missing the required `@dbxDocsUiExampleSummary` companion tag.',
      invalidSlugFormat: '`@dbxDocsUiExampleSlug` value `{{value}}` is not a valid kebab-case slug.',
      invalidCategory: '`@dbxDocsUiExampleCategory` value `{{value}}` is not allowed. Use one of: {{allowed}}.',
      relatedNotKebab: '`@dbxDocsUiExampleRelated` item `{{value}}` is not a kebab-case slug.',
      skillRefsNotKebab: '`@dbxDocsUiExampleSkillRefs` item `{{value}}` is not a kebab-case slug.',
      unknownDbxDocsUiExampleTag: '`@dbxDocsUiExample{{name}}` is not a recognized companion tag. Known companions: {{known}}.',
      duplicateCompanionTag: '`@dbxDocsUiExample{{name}}` is declared more than once.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          allowedCategories: { type: 'array' as const, items: { type: 'string' as const } },
          knownCompanions: { type: 'array' as const, items: { type: 'string' as const } },
          requireBareMarker: { type: 'boolean' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const sourceCode = context.sourceCode;
    const allowedCategories = options.allowedCategories ?? DEFAULT_ALLOWED_CATEGORIES;
    const knownCompanions = options.knownCompanions ?? DEFAULT_KNOWN_COMPANIONS;
    const requireBareMarker = options.requireBareMarker !== false;

    const allCompanions: readonly DbxCompanionTagSpec[] = [
      { suffix: 'Slug', required: true, format: { kind: 'kebab-slug' } },
      { suffix: 'Category', required: true, format: { kind: 'enum', values: allowedCategories } },
      { suffix: 'Summary', required: true, format: { kind: 'free-text' } },
      { suffix: 'Related', format: { kind: 'comma-list-kebab-slug' } },
      { suffix: 'AppRef', format: { kind: 'free-text' } },
      { suffix: 'SkillRefs', format: { kind: 'comma-list-kebab-slug' } },
      { suffix: 'Uses', multiple: true, format: { kind: 'free-text' } }
    ];
    const spec: DbxTagFamilySpec = {
      marker: 'dbxDocsUiExample',
      companions: allCompanions.filter((c) => knownCompanions.includes(c.suffix))
    };

    function checkJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const { markerTag, familyTags } = findFamilyTags(parsed, spec.marker);
      if (familyTags.length === 0) return;
      if (requireBareMarker && !markerTag) return;
      const triggerTag = markerTag ?? familyTags[0];

      checkDbxTagFamily({
        parsed,
        spec,
        markerTag: triggerTag,
        familyTags,
        emit: (v) => {
          switch (v.kind) {
            case 'missing':
            case 'empty':
              if (v.suffix === 'Slug') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'missingSlug', report: context.report });
              else if (v.suffix === 'Category') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'missingCategory', report: context.report });
              else if (v.suffix === 'Summary') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'missingSummary', report: context.report });
              break;
            case 'invalid-kebab':
              if (v.suffix === 'Slug') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'invalidSlugFormat', data: { value: v.value }, report: context.report });
              break;
            case 'invalid-enum':
              if (v.suffix === 'Category') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'invalidCategory', data: { value: v.value, allowed: v.allowed.join(', ') }, report: context.report });
              break;
            case 'comma-item-not-kebab':
              if (v.suffix === 'Related') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'relatedNotKebab', data: { value: v.value }, report: context.report });
              else if (v.suffix === 'SkillRefs') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'skillRefsNotKebab', data: { value: v.value }, report: context.report });
              break;
            case 'unknown':
              reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'unknownDbxDocsUiExampleTag', data: { name: v.suffix, known: knownCompanions.join(', ') }, report: context.report });
              break;
            case 'duplicate':
              reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'duplicateCompanionTag', data: { name: v.suffix }, report: context.report });
              break;
            default:
              break;
          }
        }
      });
    }

    function visitClass(node: AstNode): void {
      const anchor = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
      const jsdoc = leadingJsdocFor(sourceCode, anchor);
      if (jsdoc) checkJsdoc(jsdoc);
    }

    return {
      ClassDeclaration: visitClass
    };
  }
};
