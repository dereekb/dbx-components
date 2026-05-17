import { getStatementAnchor, leadingJsdocFor } from './comments';
import { parseJsdocComment } from './jsdoc-parser';
import { buildLowercaseTagsFix, checkDbxTagFamily, findFamilyTags, reportOnJsdocLine, type DbxCompanionTagSpec, type DbxTagFamilySpec } from './dbx-tag-families';

type AstNode = any;

const DEFAULT_ALLOWED_KINDS: readonly string[] = ['factory', 'const'];
const DEFAULT_KNOWN_COMPANIONS: readonly string[] = ['Slug', 'Category', 'Kind', 'Optional', 'Tags', 'Related', 'SkillRefs'];

/**
 * Options for the require-dbx-model-snapshot-field-companion-tags rule.
 */
export interface UtilRequireDbxModelSnapshotFieldCompanionTagsRuleOptions {
  readonly allowedKinds?: readonly string[];
  readonly knownCompanions?: readonly string[];
  readonly requireBareMarker?: boolean;
}

/**
 * ESLint rule definition for require-dbx-model-snapshot-field-companion-tags.
 */
export interface UtilRequireDbxModelSnapshotFieldCompanionTagsRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireDbxModelSnapshotFieldCompanionTagsRuleOptions[]; report: (descriptor: { loc?: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => AstNode | AstNode[] | null }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule enforcing `@dbxModelSnapshotField` companion tags. Mirrors the
 * scanner schema at `packages/dbx-components-mcp/src/scan/model-snapshot-fields-extract.ts`.
 */
export const utilRequireDbxModelSnapshotFieldCompanionTagsRule: UtilRequireDbxModelSnapshotFieldCompanionTagsRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require the canonical `@dbxModelSnapshotField*` companion tags on `@dbxModelSnapshotField`-tagged exports.',
      recommended: true
    },
    messages: {
      invalidKind: '`@dbxModelSnapshotFieldKind` value `{{value}}` is not allowed. Use one of: {{allowed}}.',
      invalidBooleanValue: '`@dbxModelSnapshotFieldOptional` value `{{value}}` is not a recognized boolean (use yes/no/true/false or omit).',
      slugNotKebab: '`@dbxModelSnapshotFieldSlug` value `{{value}}` is not a valid kebab-case slug.',
      tagsNotLowercase: '`@dbxModelSnapshotFieldTags` token `{{value}}` contains uppercase characters; tokens should be lowercase.',
      relatedNotKebab: '`@dbxModelSnapshotFieldRelated` item `{{value}}` is not a kebab-case slug.',
      skillRefsNotKebab: '`@dbxModelSnapshotFieldSkillRefs` item `{{value}}` is not a kebab-case slug.',
      unknownDbxModelSnapshotFieldTag: '`@dbxModelSnapshotField{{name}}` is not a recognized companion tag. Known companions: {{known}}.',
      duplicateCompanionTag: '`@dbxModelSnapshotField{{name}}` is declared more than once.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
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
    const allowedKinds = options.allowedKinds ?? DEFAULT_ALLOWED_KINDS;
    const knownCompanions = options.knownCompanions ?? DEFAULT_KNOWN_COMPANIONS;
    const requireBareMarker = options.requireBareMarker !== false;

    const allCompanions: readonly DbxCompanionTagSpec[] = [
      { suffix: 'Slug', format: { kind: 'kebab-slug' } },
      { suffix: 'Category', format: { kind: 'free-text' } },
      { suffix: 'Kind', format: { kind: 'enum', values: allowedKinds } },
      { suffix: 'Optional', format: { kind: 'boolean' } },
      { suffix: 'Tags', format: { kind: 'comma-list-lowercase' } },
      { suffix: 'Related', format: { kind: 'comma-list-kebab-slug' } },
      { suffix: 'SkillRefs', format: { kind: 'comma-list-kebab-slug' } }
    ];
    const spec: DbxTagFamilySpec = {
      marker: 'dbxModelSnapshotField',
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
            case 'invalid-kebab':
              if (v.suffix === 'Slug') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'slugNotKebab', data: { value: v.value }, report: context.report });
              break;
            case 'invalid-enum':
              if (v.suffix === 'Kind') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'invalidKind', data: { value: v.value, allowed: v.allowed.join(', ') }, report: context.report });
              break;
            case 'invalid-boolean':
              if (v.suffix === 'Optional') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'invalidBooleanValue', data: { value: v.value }, report: context.report });
              break;
            case 'comma-item-not-kebab':
              if (v.suffix === 'Related') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'relatedNotKebab', data: { value: v.value }, report: context.report });
              else if (v.suffix === 'SkillRefs') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'skillRefsNotKebab', data: { value: v.value }, report: context.report });
              break;
            case 'tags-not-lowercase': {
              if (v.suffix !== 'Tags') break;
              const fix = buildLowercaseTagsFix({ commentNode, parsed, sourceCode, tag: v.raw });
              const fixer = fix ? (fixer2: AstNode) => fixer2.replaceTextRange([fix.startOffset, fix.endOffset], fix.replacement) : undefined;
              reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'tagsNotLowercase', data: { value: v.value }, report: context.report, fix: fixer });
              break;
            }
            case 'unknown':
              reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'unknownDbxModelSnapshotFieldTag', data: { name: v.suffix, known: knownCompanions.join(', ') }, report: context.report });
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
      FunctionDeclaration: (node: AstNode) => {
        if (!node.body) return;
        const jsdoc = leadingJsdocFor(sourceCode, getStatementAnchor(node));
        if (jsdoc) checkJsdoc(jsdoc);
      },
      VariableDeclaration: visit
    };
  }
};
