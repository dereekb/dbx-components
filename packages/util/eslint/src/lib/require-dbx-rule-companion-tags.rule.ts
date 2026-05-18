import { leadingJsdocFor } from './comments';
import { parseJsdocComment, type ParsedJsdoc, type ParsedJsdocTag } from './jsdoc-parser';
import { reportOnJsdocLine } from './dbx-tag-families';

interface AstNode {
  readonly type: string;
  [key: string]: any;
}

const DEFAULT_ALLOWED_SEVERITIES: readonly string[] = ['error', 'warning'];
const DEFAULT_ALLOWED_SEE_ALSO_KINDS: readonly string[] = ['artifact', 'tool', 'doc'];
const DEFAULT_KNOWN_COMPANIONS: readonly string[] = ['Severity', 'Applies', 'NotApplies', 'Fix', 'Template', 'SeeAlso'];
const MULTIPLE_COMPANIONS: ReadonlySet<string> = new Set(['SeeAlso']);
const REQUIRED_SIMPLE_COMPANIONS: readonly (readonly [string, string])[] = [
  ['Applies', 'missingApplies'],
  ['NotApplies', 'missingNotApplies'],
  ['Fix', 'missingFix']
];

interface RuleReportContext {
  readonly commentNode: AstNode;
  readonly parsed: ParsedJsdoc;
  readonly sourceCode: AstNode;
  readonly report: (descriptor: { loc?: AstNode; messageId: string; data?: Record<string, string> }) => void;
}

function reportUnknownCompanions(ctx: RuleReportContext, companions: ReadonlyMap<string, ParsedJsdocTag[]>, knownCompanions: readonly string[]): void {
  for (const [suffix, instances] of companions.entries()) {
    if (knownCompanions.includes(suffix)) continue;
    for (const tag of instances) {
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tag.startLineIndex, messageId: 'unknownDbxRuleTag', data: { name: suffix, known: knownCompanions.join(', ') }, report: ctx.report });
    }
  }
}

function reportDuplicates(ctx: RuleReportContext, companions: ReadonlyMap<string, ParsedJsdocTag[]>): void {
  for (const [suffix, instances] of companions.entries()) {
    if (MULTIPLE_COMPANIONS.has(suffix) || instances.length <= 1) continue;
    for (let i = 1; i < instances.length; i += 1) {
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: instances[i].startLineIndex, messageId: 'duplicateCompanionTag', data: { name: suffix }, report: ctx.report });
    }
  }
}

interface ReportSeverityInput {
  readonly ctx: RuleReportContext;
  readonly severityTags: readonly ParsedJsdocTag[];
  readonly triggerLine: number;
  readonly allowedSeverities: readonly string[];
}

function reportSeverity(input: ReportSeverityInput): void {
  const { ctx, severityTags, triggerLine, allowedSeverities } = input;
  if (severityTags.length === 0 || severityTags[0].description.trim().length === 0) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: triggerLine, messageId: 'missingSeverity', report: ctx.report });
    return;
  }
  const value = severityTags[0].description.trim();
  if (!allowedSeverities.includes(value)) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: severityTags[0].startLineIndex, messageId: 'invalidSeverity', data: { value, allowed: allowedSeverities.join(', ') }, report: ctx.report });
  }
}

function reportSeeAlso(ctx: RuleReportContext, seeAlsoTags: readonly ParsedJsdocTag[], allowedSeeAlsoKinds: readonly string[]): void {
  for (const tag of seeAlsoTags) {
    const raw = tag.description.trim();
    if (raw.length === 0) continue;
    const colonIdx = raw.indexOf(':');
    if (colonIdx <= 0) {
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tag.startLineIndex, messageId: 'invalidSeeAlsoFormat', data: { value: raw }, report: ctx.report });
      continue;
    }
    const kind = raw.slice(0, colonIdx).trim();
    if (!allowedSeeAlsoKinds.includes(kind)) {
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tag.startLineIndex, messageId: 'invalidSeeAlsoKind', data: { value: kind, allowed: allowedSeeAlsoKinds.join(', ') }, report: ctx.report });
    }
  }
}

function collectRuleCompanions(parsed: ParsedJsdoc): { readonly markerTag: ParsedJsdocTag | undefined; readonly companions: Map<string, ParsedJsdocTag[]> } {
  const markerTag = parsed.tags.find((t) => t.tag === 'dbxRule');
  const companions = new Map<string, ParsedJsdocTag[]>();
  for (const tag of parsed.tags) {
    if (!tag.tag.startsWith('dbxRule') || tag.tag === 'dbxRule') continue;
    const suffix = tag.tag.slice('dbxRule'.length);
    const list = companions.get(suffix) ?? [];
    list.push(tag);
    companions.set(suffix, list);
  }
  return { markerTag, companions };
}

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
export const UTIL_REQUIRE_DBX_RULE_COMPANION_TAGS_RULE: UtilRequireDbxRuleCompanionTagsRuleDefinition = {
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

    function checkEnumMemberJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const { markerTag, companions } = collectRuleCompanions(parsed);
      if ((!markerTag && companions.size === 0) || (requireBareMarker && !markerTag)) return;

      const ctx: RuleReportContext = { commentNode, parsed, sourceCode, report: context.report };
      const triggerLine = markerTag?.startLineIndex ?? 0;

      reportUnknownCompanions(ctx, companions, knownCompanions);
      reportDuplicates(ctx, companions);
      reportSeverity({ ctx, severityTags: companions.get('Severity') ?? [], triggerLine, allowedSeverities });

      for (const [suffix, messageId] of REQUIRED_SIMPLE_COMPANIONS) {
        const tags = companions.get(suffix) ?? [];
        if (tags.length === 0 || tags[0].description.trim().length === 0) {
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: triggerLine, messageId, report: context.report });
        }
      }

      reportSeeAlso(ctx, companions.get('SeeAlso') ?? [], allowedSeeAlsoKinds);
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
