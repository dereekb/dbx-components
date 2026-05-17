import { leadingJsdocFor } from './comments';
import { parseJsdocComment, type ParsedJsdocTag } from './jsdoc-parser';
import { reportOnJsdocLine } from './dbx-tag-families';

type AstNode = any;

const DEFAULT_ALLOWED_SEVERITIES: readonly string[] = ['error', 'warning'];
const DEFAULT_ALLOWED_SEE_ALSO_KINDS: readonly string[] = ['artifact', 'tool', 'doc'];
const DEFAULT_KNOWN_COMPANIONS: readonly string[] = ['Severity', 'Applies', 'NotApplies', 'Fix', 'Template', 'SeeAlso'];

/**
 * Options for the require-dbx-rule-companion-tags rule.
 */
export interface UtilRequireDbxRuleCompanionTagsRuleOptions {
  readonly allowedSeverities?: readonly string[];
  readonly allowedSeeAlsoKinds?: readonly string[];
  readonly knownCompanions?: readonly string[];
  readonly requireBareMarker?: boolean;
}

/**
 * ESLint rule definition for require-dbx-rule-companion-tags.
 */
export interface UtilRequireDbxRuleCompanionTagsRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireDbxRuleCompanionTagsRuleOptions[]; report: (descriptor: { loc?: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule enforcing `@dbxRule` companion tags on enum members in
 * `codes.ts` files. Mirrors the extractor at
 * `packages/dbx-components-mcp/scripts/extract-rule-catalog.mjs`.
 */
export const utilRequireDbxRuleCompanionTagsRule: UtilRequireDbxRuleCompanionTagsRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require the canonical `@dbxRule*` companion tags on `@dbxRule`-tagged enum members.',
      recommended: true
    },
    messages: {
      missingSeverity: '`@dbxRule`-tagged enum member is missing the required `@dbxRuleSeverity <error|warning>` companion tag.',
      invalidSeverity: '`@dbxRuleSeverity` value `{{value}}` is not allowed. Use one of: {{allowed}}.',
      missingApplies: '`@dbxRule`-tagged enum member is missing the required `@dbxRuleApplies` companion tag.',
      missingNotApplies: '`@dbxRule`-tagged enum member is missing the required `@dbxRuleNotApplies` companion tag.',
      missingFix: '`@dbxRule`-tagged enum member is missing the required `@dbxRuleFix` companion tag.',
      invalidSeeAlsoFormat: '`@dbxRuleSeeAlso` value `{{value}}` is malformed; expected `<kind>:<target>`.',
      invalidSeeAlsoKind: '`@dbxRuleSeeAlso` kind `{{value}}` is not allowed. Use one of: {{allowed}}.',
      unknownDbxRuleTag: '`@dbxRule{{name}}` is not a recognized companion tag. Known companions: {{known}}.',
      duplicateCompanionTag: '`@dbxRule{{name}}` is declared more than once.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          allowedSeverities: { type: 'array' as const, items: { type: 'string' as const } },
          allowedSeeAlsoKinds: { type: 'array' as const, items: { type: 'string' as const } },
          knownCompanions: { type: 'array' as const, items: { type: 'string' as const } },
          requireBareMarker: { type: 'boolean' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const sourceCode = context.sourceCode;
    const allowedSeverities = options.allowedSeverities ?? DEFAULT_ALLOWED_SEVERITIES;
    const allowedSeeAlsoKinds = options.allowedSeeAlsoKinds ?? DEFAULT_ALLOWED_SEE_ALSO_KINDS;
    const knownCompanions = options.knownCompanions ?? DEFAULT_KNOWN_COMPANIONS;
    const requireBareMarker = options.requireBareMarker !== false;
    const multipleCompanions: ReadonlySet<string> = new Set(['SeeAlso']);

    function checkEnumMemberJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const markerTag = parsed.tags.find((t) => t.tag === 'dbxRule');
      const companions = new Map<string, ParsedJsdocTag[]>();
      for (const tag of parsed.tags) {
        if (!tag.tag.startsWith('dbxRule') || tag.tag === 'dbxRule') continue;
        const suffix = tag.tag.slice('dbxRule'.length);
        const list = companions.get(suffix) ?? [];
        list.push(tag);
        companions.set(suffix, list);
      }
      if ((!markerTag && companions.size === 0) || (requireBareMarker && !markerTag)) return;
      const triggerLine = markerTag?.startLineIndex ?? 0;

      // Unknown companions.
      for (const [suffix, instances] of companions.entries()) {
        if (!knownCompanions.includes(suffix)) {
          for (const tag of instances) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'unknownDbxRuleTag', data: { name: suffix, known: knownCompanions.join(', ') }, report: context.report });
        }
      }

      // Duplicate detection (excluding repeatable SeeAlso).
      for (const [suffix, instances] of companions.entries()) {
        if (multipleCompanions.has(suffix) || instances.length <= 1) continue;
        for (let i = 1; i < instances.length; i += 1) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: instances[i].startLineIndex, messageId: 'duplicateCompanionTag', data: { name: suffix }, report: context.report });
      }

      // Required Severity.
      const severityTags = companions.get('Severity') ?? [];
      if (severityTags.length === 0 || severityTags[0].description.trim().length === 0) {
        reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: triggerLine, messageId: 'missingSeverity', report: context.report });
      } else {
        const value = severityTags[0].description.trim();
        if (!allowedSeverities.includes(value)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: severityTags[0].startLineIndex, messageId: 'invalidSeverity', data: { value, allowed: allowedSeverities.join(', ') }, report: context.report });
      }

      // Required Applies, NotApplies, Fix.
      for (const [suffix, messageId] of [
        ['Applies', 'missingApplies'],
        ['NotApplies', 'missingNotApplies'],
        ['Fix', 'missingFix']
      ] as const) {
        const tags = companions.get(suffix) ?? [];
        if (tags.length === 0 || tags[0].description.trim().length === 0) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: triggerLine, messageId, report: context.report });
      }

      // SeeAlso format + kind validation.
      for (const tag of companions.get('SeeAlso') ?? []) {
        const raw = tag.description.trim();
        if (raw.length === 0) continue;
        const colonIdx = raw.indexOf(':');
        if (colonIdx <= 0) {
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'invalidSeeAlsoFormat', data: { value: raw }, report: context.report });
          continue;
        }
        const kind = raw.slice(0, colonIdx).trim();
        if (!allowedSeeAlsoKinds.includes(kind)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'invalidSeeAlsoKind', data: { value: kind, allowed: allowedSeeAlsoKinds.join(', ') }, report: context.report });
      }
    }

    function visitEnumMember(node: AstNode): void {
      const jsdoc = leadingJsdocFor(sourceCode, node);
      if (jsdoc) checkEnumMemberJsdoc(jsdoc);
    }

    return {
      TSEnumMember: visitEnumMember
    };
  }
};
