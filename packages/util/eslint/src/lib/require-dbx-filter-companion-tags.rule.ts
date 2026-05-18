import { leadingJsdocFor } from './comments';
import { parseJsdocComment } from './jsdoc-parser';
import { checkDbxTagFamily, findFamilyTags, reportOnJsdocLine, type DbxCompanionTagSpec, type DbxTagFamilySpec } from './dbx-tag-families';

interface AstNode {
  readonly type: string;
  // index signature keeps the loose-typed semantics of the original `= any`
  // so the rule body can freely navigate AST properties without churn.
  [key: string]: any;
}

const DEFAULT_KNOWN_COMPANIONS: readonly string[] = ['Slug', 'Related', 'SkillRefs'];

/**
 * Options for the require-dbx-filter-companion-tags rule.
 */
export interface UtilRequireDbxFilterCompanionTagsRuleOptions {
  readonly knownCompanions?: readonly string[];
  readonly requireBareMarker?: boolean;
}

/**
 * ESLint rule definition for require-dbx-filter-companion-tags.
 */
export interface UtilRequireDbxFilterCompanionTagsRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireDbxFilterCompanionTagsRuleOptions[]; report: (descriptor: { loc?: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule enforcing `@dbxFilter` companion tags. Mirrors the scanner
 * schema at `packages/dbx-components-mcp/src/scan/filters-extract.ts`.
 * Applies to classes (filter directives) and exported interfaces (filter
 * patterns); the scanner reads both as filter entries.
 */
export const utilRequireDbxFilterCompanionTagsRule: UtilRequireDbxFilterCompanionTagsRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require the canonical `@dbxFilter*` companion tags on `@dbxFilter`-tagged declarations.',
      recommended: true
    },
    messages: {
      missingSlug: '`@dbxFilter`-tagged declaration is missing the required `@dbxFilterSlug <slug>` companion tag.',
      invalidSlugFormat: '`@dbxFilterSlug` value `{{value}}` is not a valid kebab-case slug.',
      relatedNotKebab: '`@dbxFilterRelated` item `{{value}}` is not a kebab-case slug.',
      skillRefsNotKebab: '`@dbxFilterSkillRefs` item `{{value}}` is not a kebab-case slug.',
      unknownDbxFilterTag: '`@dbxFilter{{name}}` is not a recognized companion tag. Known companions: {{known}}.',
      duplicateCompanionTag: '`@dbxFilter{{name}}` is declared more than once.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          knownCompanions: { type: 'array' as const, items: { type: 'string' as const } },
          requireBareMarker: { type: 'boolean' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const sourceCode = context.sourceCode;
    const knownCompanions = options.knownCompanions ?? DEFAULT_KNOWN_COMPANIONS;
    const requireBareMarker = options.requireBareMarker !== false;

    const allCompanions: readonly DbxCompanionTagSpec[] = [
      { suffix: 'Slug', required: true, format: { kind: 'kebab-slug' } },
      { suffix: 'Related', format: { kind: 'comma-list-kebab-slug' } },
      { suffix: 'SkillRefs', format: { kind: 'comma-list-kebab-slug' } }
    ];
    const spec: DbxTagFamilySpec = {
      marker: 'dbxFilter',
      companions: allCompanions.filter((c) => knownCompanions.includes(c.suffix))
    };

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
        emit: (v) => {
          switch (v.kind) {
            case 'missing':
            case 'empty':
              if (v.suffix === 'Slug') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'missingSlug', report: context.report });
              break;
            case 'invalid-kebab':
              if (v.suffix === 'Slug') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'invalidSlugFormat', data: { value: v.value }, report: context.report });
              break;
            case 'comma-item-not-kebab':
              if (v.suffix === 'Related') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'relatedNotKebab', data: { value: v.value }, report: context.report });
              else if (v.suffix === 'SkillRefs') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'skillRefsNotKebab', data: { value: v.value }, report: context.report });
              break;
            case 'unknown':
              reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'unknownDbxFilterTag', data: { name: v.suffix, known: knownCompanions.join(', ') }, report: context.report });
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

    function visit(node: AstNode): void {
      const anchor = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
      const jsdoc = leadingJsdocFor(sourceCode, anchor);
      if (jsdoc) checkJsdoc(jsdoc);
    }

    return {
      ClassDeclaration: visit,
      TSInterfaceDeclaration: visit
    };
  }
};
