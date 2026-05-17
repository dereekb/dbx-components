import { leadingJsdocFor } from './comments';
import { parseJsdocComment } from './jsdoc-parser';
import { checkDbxTagFamily, reportOnJsdocLine, type DbxCompanionTagSpec, type DbxTagFamilySpec } from './dbx-tag-families';

type AstNode = any;

const DEFAULT_ALLOWED_CATEGORIES: readonly string[] = ['layout', 'list', 'button', 'card', 'feedback', 'overlay', 'navigation', 'text', 'screen', 'action', 'router', 'misc'];
const DEFAULT_ALLOWED_KINDS: readonly string[] = ['component', 'directive', 'pipe', 'service'];
const DEFAULT_KNOWN_COMPANIONS: readonly string[] = ['Slug', 'Category', 'Kind', 'Related', 'SkillRefs', 'ContentProjection', 'MinimalExample', 'InputName', 'InputType', 'InputRequired'];

/**
 * Options for the require-dbx-web-companion-tags rule.
 */
export interface UtilRequireDbxWebCompanionTagsRuleOptions {
  readonly allowedCategories?: readonly string[];
  readonly allowedKinds?: readonly string[];
  readonly knownCompanions?: readonly string[];
  readonly requireBareMarker?: boolean;
}

/**
 * ESLint rule definition for require-dbx-web-companion-tags.
 */
export interface UtilRequireDbxWebCompanionTagsRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireDbxWebCompanionTagsRuleOptions[]; report: (descriptor: { loc?: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule enforcing `@dbxWebComponent` companion tags. Mirrors the scanner
 * schema at `packages/dbx-components-mcp/src/scan/ui-components-extract.ts`.
 */
export const utilRequireDbxWebCompanionTagsRule: UtilRequireDbxWebCompanionTagsRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require the canonical `@dbxWeb*` companion tags on `@dbxWebComponent`-tagged classes.',
      recommended: true
    },
    messages: {
      missingSlug: '`@dbxWebComponent`-tagged class is missing the required `@dbxWebSlug <slug>` companion tag.',
      missingCategory: '`@dbxWebComponent`-tagged class is missing the required `@dbxWebCategory` companion tag.',
      invalidSlugFormat: '`@dbxWebSlug` value `{{value}}` is not a valid kebab-case slug.',
      invalidCategory: '`@dbxWebCategory` value `{{value}}` is not allowed. Use one of: {{allowed}}.',
      invalidKind: '`@dbxWebKind` value `{{value}}` is not allowed. Use one of: {{allowed}}.',
      relatedNotKebab: '`@dbxWebRelated` item `{{value}}` is not a kebab-case slug.',
      skillRefsNotKebab: '`@dbxWebSkillRefs` item `{{value}}` is not a kebab-case slug.',
      unknownDbxWebTag: '`@dbxWeb{{name}}` is not a recognized companion tag. Known companions: {{known}}.',
      duplicateCompanionTag: '`@dbxWeb{{name}}` is declared more than once.'
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
    const allowedCategories = options.allowedCategories ?? DEFAULT_ALLOWED_CATEGORIES;
    const allowedKinds = options.allowedKinds ?? DEFAULT_ALLOWED_KINDS;
    const knownCompanions = options.knownCompanions ?? DEFAULT_KNOWN_COMPANIONS;
    const requireBareMarker = options.requireBareMarker !== false;

    // Class-level companions (Slug, Category, Kind, Related, SkillRefs, ContentProjection, MinimalExample).
    const allClassCompanions: readonly DbxCompanionTagSpec[] = [
      { suffix: 'Slug', required: true, format: { kind: 'kebab-slug' } },
      { suffix: 'Category', required: true, format: { kind: 'enum', values: allowedCategories } },
      { suffix: 'Kind', format: { kind: 'enum', values: allowedKinds } },
      { suffix: 'Related', format: { kind: 'comma-list-kebab-slug' } },
      { suffix: 'SkillRefs', format: { kind: 'comma-list-kebab-slug' } },
      { suffix: 'ContentProjection', format: { kind: 'free-text' } },
      { suffix: 'MinimalExample', format: { kind: 'free-text' } }
    ];
    const classSpec: DbxTagFamilySpec = {
      marker: 'dbxWeb',
      companions: allClassCompanions.filter((c) => knownCompanions.includes(c.suffix))
    };

    function checkClassJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      // The marker is the bare `@dbxWebComponent` tag. Note this tag does NOT
      // match the `dbxWeb` prefix-stripping convention; the scanner treats
      // `dbxWebComponent` as the trigger, then reads `@dbxWeb<Suffix>` companions.
      const markerTag = parsed.tags.find((t) => t.tag === 'dbxWebComponent');
      const companionTags = parsed.tags.filter((t) => t.tag.startsWith('dbxWeb') && t.tag !== 'dbxWebComponent');
      if (!markerTag && companionTags.length === 0) return;
      if (requireBareMarker && !markerTag) return;
      const triggerTag = markerTag ?? companionTags[0];

      // Pass only the companion tags (those starting with `dbxWeb` but not the
      // `dbxWebComponent` marker) into the shared checker; the marker tag is
      // passed separately and only its line index is used for "missing" reports.
      checkDbxTagFamily({
        parsed,
        spec: classSpec,
        markerTag: triggerTag,
        familyTags: companionTags,
        emit: (v) => {
          switch (v.kind) {
            case 'missing':
            case 'empty':
              if (v.suffix === 'Slug') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'missingSlug', report: context.report });
              else if (v.suffix === 'Category') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'missingCategory', report: context.report });
              break;
            case 'invalid-kebab':
              if (v.suffix === 'Slug') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'invalidSlugFormat', data: { value: v.value }, report: context.report });
              break;
            case 'invalid-enum':
              if (v.suffix === 'Category') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'invalidCategory', data: { value: v.value, allowed: v.allowed.join(', ') }, report: context.report });
              else if (v.suffix === 'Kind') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'invalidKind', data: { value: v.value, allowed: v.allowed.join(', ') }, report: context.report });
              break;
            case 'comma-item-not-kebab':
              if (v.suffix === 'Related') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'relatedNotKebab', data: { value: v.value }, report: context.report });
              else if (v.suffix === 'SkillRefs') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'skillRefsNotKebab', data: { value: v.value }, report: context.report });
              break;
            case 'unknown':
              // Property-level companions (InputName/InputType/InputRequired) are
              // reported only as "unknown" when they appear on a class JSDoc;
              // they're recognized at property scope below.
              if (v.suffix === 'InputName' || v.suffix === 'InputType' || v.suffix === 'InputRequired') break;
              reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'unknownDbxWebTag', data: { name: v.suffix, known: knownCompanions.join(', ') }, report: context.report });
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
      if (jsdoc) checkClassJsdoc(jsdoc);
    }

    return {
      ClassDeclaration: visitClass
    };
  }
};
