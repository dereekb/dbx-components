import { getStatementAnchor, leadingJsdocFor } from './comments';
import type { Maybe } from '@dereekb/util';
import { parseJsdocComment, type ParsedJsdoc, type ParsedJsdocTag } from './jsdoc-parser';
import { KEBAB_SLUG_PATTERN, reportOnJsdocLine, splitCommaSeparated } from './dbx-tag-families';

interface AstNode {
  readonly type: string;
  [key: string]: any;
}

const FORM_MARKERS: ReadonlySet<string> = new Set(['dbxFormField', 'dbxFormFieldDerivative', 'dbxFormFieldTemplate']);
const COMPOSES_FROM_MARKERS: ReadonlySet<string> = new Set(['dbxFormFieldDerivative', 'dbxFormFieldTemplate']);
const DEFAULT_ALLOWED_TIERS: readonly string[] = ['field-factory', 'field-derivative', 'composite-builder', 'template-builder', 'primitive'];
const DEFAULT_ALLOWED_WRAPPER_PATTERNS: readonly string[] = ['unwrapped', 'material-form-field-wrapped'];
const DEFAULT_ALLOWED_SUFFIXES: readonly string[] = ['Row', 'Group', 'Fields', 'Field', 'Wrapper', 'Layout'];
const DEFAULT_ALLOWED_ARRAY_OUTPUTS: readonly string[] = ['yes', 'no', 'optional'];
const DEFAULT_KNOWN_COMPANIONS: readonly string[] = ['Slug', 'Tier', 'Produces', 'ArrayOutput', 'WrapperPattern', 'NgFormType', 'Suffix', 'Returns', 'ComposesFrom', 'ConfigInterface', 'PropsInterface', 'Generic', 'PropName'];

/**
 * Splits a `@dbxFormField` JSDoc into its marker tags and the map of
 * `@dbxForm*` companion tags keyed by their suffix.
 *
 * @param parsed - The parsed JSDoc to inspect.
 * @returns The list of marker tags and the map of companion suffix to tag instances.
 */
function collectFormTags(parsed: ParsedJsdoc): { readonly markers: ParsedJsdocTag[]; readonly companions: Map<string, ParsedJsdocTag[]> } {
  const markers: ParsedJsdocTag[] = [];
  const companions = new Map<string, ParsedJsdocTag[]>();
  for (const tag of parsed.tags) {
    if (FORM_MARKERS.has(tag.tag)) {
      markers.push(tag);
    } else if (tag.tag.startsWith('dbxForm') && !tag.tag.startsWith('dbxFormField')) {
      const suffix = tag.tag.slice('dbxForm'.length);
      const list = companions.get(suffix) ?? [];
      list.push(tag);
      companions.set(suffix, list);
    }
  }
  return { markers, companions };
}

/**
 * Resolves the effective tier for a `@dbxFormField`-family JSDoc by
 * preferring marker-derived tiers (e.g. `@dbxFormFieldDerivative` →
 * `'field-derivative'`) and falling back to the first `@dbxFormTier`.
 *
 * @param markers - The marker tags found on the JSDoc.
 * @param tierTags - Any explicit `@dbxFormTier` tags found on the JSDoc.
 * @returns The resolved tier, or `undefined` when none is present.
 */
function determineTier(markers: readonly ParsedJsdocTag[], tierTags: readonly ParsedJsdocTag[]): Maybe<string> {
  // Marker-derived tier takes precedence; `@dbxFormFieldDerivative` → 'field-derivative', `@dbxFormFieldTemplate` → 'template-builder'.
  // `@dbxFormField` requires an explicit `@dbxFormTier`.
  let derived: Maybe<string>;
  for (const m of markers) {
    if (m.tag === 'dbxFormFieldDerivative') derived = 'field-derivative';
    else if (m.tag === 'dbxFormFieldTemplate') derived = 'template-builder';
  }
  if (derived !== undefined) {
    return derived;
  }
  return tierTags.length > 0 ? tierTags[0].description.trim() : undefined;
}

interface FormReportContext {
  readonly commentNode: AstNode;
  readonly parsed: ParsedJsdoc;
  readonly sourceCode: AstNode;
  readonly report: (descriptor: { loc?: AstNode; messageId: string; data?: Record<string, string> }) => void;
}

function reportFormDuplicateMarkers(ctx: FormReportContext, markers: readonly ParsedJsdocTag[]): void {
  if (markers.length <= 1) return;
  for (let i = 1; i < markers.length; i += 1) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: markers[i].startLineIndex, messageId: 'duplicateMarker', report: ctx.report });
  }
}

function reportFormUnknownCompanions(ctx: FormReportContext, companions: ReadonlyMap<string, ParsedJsdocTag[]>, knownCompanions: readonly string[]): void {
  for (const [suffix, instances] of companions.entries()) {
    if (knownCompanions.includes(suffix)) continue;
    for (const tag of instances) {
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tag.startLineIndex, messageId: 'unknownDbxFormTag', data: { name: suffix, known: knownCompanions.join(', ') }, report: ctx.report });
    }
  }
}

function reportFormDuplicateCompanions(ctx: FormReportContext, companions: ReadonlyMap<string, ParsedJsdocTag[]>): void {
  for (const [suffix, instances] of companions.entries()) {
    if (instances.length <= 1) continue;
    for (let i = 1; i < instances.length; i += 1) {
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: instances[i].startLineIndex, messageId: 'duplicateCompanionTag', data: { name: suffix }, report: ctx.report });
    }
  }
}

function reportFormSlug(ctx: FormReportContext, slugTags: readonly ParsedJsdocTag[], triggerLine: number): void {
  if (slugTags.length === 0) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: triggerLine, messageId: 'missingSlug', report: ctx.report });
    return;
  }
  const value = slugTags[0].description.trim();
  if (value.length === 0) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: slugTags[0].startLineIndex, messageId: 'missingSlug', report: ctx.report });
  } else if (!KEBAB_SLUG_PATTERN.test(value)) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: slugTags[0].startLineIndex, messageId: 'invalidSlugFormat', data: { value }, report: ctx.report });
  }
}

function reportFormProduces(ctx: FormReportContext, producesTags: readonly ParsedJsdocTag[], triggerLine: number): void {
  if (producesTags.length === 0 || producesTags[0].description.trim().length === 0) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: triggerLine, messageId: 'missingProduces', report: ctx.report });
  }
}

interface ReportFormArrayOutputInput {
  readonly ctx: FormReportContext;
  readonly arrayOutputTags: readonly ParsedJsdocTag[];
  readonly allowedArrayOutputs: readonly string[];
  readonly triggerLine: number;
}

function reportFormArrayOutput(input: ReportFormArrayOutputInput): void {
  const { ctx, arrayOutputTags, allowedArrayOutputs, triggerLine } = input;
  if (arrayOutputTags.length === 0 || arrayOutputTags[0].description.trim().length === 0) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: triggerLine, messageId: 'missingArrayOutput', report: ctx.report });
    return;
  }
  const value = arrayOutputTags[0].description.trim();
  if (!allowedArrayOutputs.includes(value)) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: arrayOutputTags[0].startLineIndex, messageId: 'invalidArrayOutput', data: { value, allowed: allowedArrayOutputs.join(', ') }, report: ctx.report });
  }
}

interface ReportFormTierInput {
  readonly ctx: FormReportContext;
  readonly markers: readonly ParsedJsdocTag[];
  readonly tierTags: readonly ParsedJsdocTag[];
  readonly tier: Maybe<string>;
  readonly allowedTiers: readonly string[];
  readonly triggerLine: number;
}

function reportFormTier(input: ReportFormTierInput): void {
  const { ctx, markers, tierTags, tier, allowedTiers, triggerLine } = input;
  if (!markers.some((m) => m.tag === 'dbxFormField')) return;
  if (tier == null) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: triggerLine, messageId: 'missingTier', report: ctx.report });
  } else if (!allowedTiers.includes(tier)) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tierTags[0]?.startLineIndex ?? triggerLine, messageId: 'invalidTier', data: { value: tier, allowed: allowedTiers.join(', ') }, report: ctx.report });
  }
}

interface ReportFormWrapperPatternInput {
  readonly ctx: FormReportContext;
  readonly wrapperTags: readonly ParsedJsdocTag[];
  readonly allowedWrapperPatterns: readonly string[];
  readonly triggerLine: number;
}

function reportFormWrapperPattern(input: ReportFormWrapperPatternInput): void {
  const { ctx, wrapperTags, allowedWrapperPatterns, triggerLine } = input;
  if (wrapperTags.length === 0 || wrapperTags[0].description.trim().length === 0) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: triggerLine, messageId: 'missingWrapperPattern', report: ctx.report });
    return;
  }
  const value = wrapperTags[0].description.trim();
  if (!allowedWrapperPatterns.includes(value)) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: wrapperTags[0].startLineIndex, messageId: 'invalidWrapperPattern', data: { value, allowed: allowedWrapperPatterns.join(', ') }, report: ctx.report });
  }
}

interface ReportFormFieldFactoryTierInput {
  readonly ctx: FormReportContext;
  readonly companions: ReadonlyMap<string, ParsedJsdocTag[]>;
  readonly allowedWrapperPatterns: readonly string[];
  readonly triggerLine: number;
}

function reportFormFieldFactoryTier(input: ReportFormFieldFactoryTierInput): void {
  const { ctx, companions, allowedWrapperPatterns, triggerLine } = input;
  reportFormWrapperPattern({ ctx, wrapperTags: companions.get('WrapperPattern') ?? [], allowedWrapperPatterns, triggerLine });
  const ngFormTags = companions.get('NgFormType') ?? [];
  if (ngFormTags.length === 0 || ngFormTags[0].description.trim().length === 0) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: triggerLine, messageId: 'missingNgFormType', report: ctx.report });
  }
}

interface ReportFormCompositeBuilderTierInput {
  readonly ctx: FormReportContext;
  readonly suffixTags: readonly ParsedJsdocTag[];
  readonly allowedSuffixes: readonly string[];
  readonly triggerLine: number;
}

function reportFormCompositeBuilderTier(input: ReportFormCompositeBuilderTierInput): void {
  const { ctx, suffixTags, allowedSuffixes, triggerLine } = input;
  if (suffixTags.length === 0 || suffixTags[0].description.trim().length === 0) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: triggerLine, messageId: 'missingSuffix', report: ctx.report });
    return;
  }
  const value = suffixTags[0].description.trim();
  if (!allowedSuffixes.includes(value)) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: suffixTags[0].startLineIndex, messageId: 'invalidSuffix', data: { value, allowed: allowedSuffixes.join(', ') }, report: ctx.report });
  }
}

interface ReportFormDerivativeTierInput {
  readonly ctx: FormReportContext;
  readonly markers: readonly ParsedJsdocTag[];
  readonly composesFromTags: readonly ParsedJsdocTag[];
  readonly triggerLine: number;
}

function reportFormDerivativeTier(input: ReportFormDerivativeTierInput): void {
  const { ctx, markers, composesFromTags, triggerLine } = input;
  const markerCarriesComposes = markers.some((m) => COMPOSES_FROM_MARKERS.has(m.tag) && m.description.trim().length > 0);
  if (composesFromTags.length === 0 && !markerCarriesComposes) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: triggerLine, messageId: 'missingComposesFrom', report: ctx.report });
  }
}

function reportFormComposesFromKebab(ctx: FormReportContext, composesFromTags: readonly ParsedJsdocTag[], markers: readonly ParsedJsdocTag[]): void {
  for (const tag of composesFromTags) {
    for (const item of splitCommaSeparated(tag.description)) {
      if (!KEBAB_SLUG_PATTERN.test(item)) {
        reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tag.startLineIndex, messageId: 'composesFromNotKebab', data: { value: item }, report: ctx.report });
      }
    }
  }
  for (const m of markers) {
    if (!COMPOSES_FROM_MARKERS.has(m.tag)) continue;
    for (const item of splitCommaSeparated(m.description)) {
      if (!KEBAB_SLUG_PATTERN.test(item)) {
        reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: m.startLineIndex, messageId: 'composesFromNotKebab', data: { value: item }, report: ctx.report });
      }
    }
  }
}

/**
 * Options for the require-dbx-form-field-companion-tags rule.
 */
export interface UtilRequireDbxFormFieldCompanionTagsRuleOptions {
  readonly allowedTiers?: readonly string[];
  readonly allowedWrapperPatterns?: readonly string[];
  readonly allowedSuffixes?: readonly string[];
  readonly allowedArrayOutputs?: readonly string[];
  readonly knownCompanions?: readonly string[];
  readonly requireBareMarker?: boolean;
}

/**
 * ESLint rule definition for require-dbx-form-field-companion-tags.
 */
export interface UtilRequireDbxFormFieldCompanionTagsRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireDbxFormFieldCompanionTagsRuleOptions[]; report: (descriptor: { loc?: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule enforcing `@dbxFormField` companion tags. Mirrors the scanner
 * schema at `packages/dbx-cli/src/lib/mcp-scan/scan/forge-fields-extract.ts`,
 * including the tier-conditional required-tag matrix.
 */
export const UTIL_REQUIRE_DBX_FORM_FIELD_COMPANION_TAGS_RULE: UtilRequireDbxFormFieldCompanionTagsRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require the canonical `@dbxForm*` companion tags on `@dbxFormField`-tagged factories.',
      recommended: true
    },
    messages: {
      duplicateMarker: '`@dbxFormField` / `@dbxFormFieldDerivative` / `@dbxFormFieldTemplate` are mutually exclusive; only one is allowed.',
      missingTier: '`@dbxFormField`-tagged factory is missing the required `@dbxFormTier <tier>` companion tag.',
      invalidTier: '`@dbxFormTier` value `{{value}}` is not allowed. Use one of: {{allowed}}.',
      missingSlug: '`@dbxFormField`-tagged factory is missing the required `@dbxFormSlug <slug>` companion tag.',
      invalidSlugFormat: '`@dbxFormSlug` value `{{value}}` is not a valid kebab-case slug.',
      missingProduces: '`@dbxFormField`-tagged factory is missing the required `@dbxFormProduces <type>` companion tag.',
      missingArrayOutput: '`@dbxFormField`-tagged factory is missing the required `@dbxFormArrayOutput <yes|no|optional>` companion tag.',
      invalidArrayOutput: '`@dbxFormArrayOutput` value `{{value}}` is not allowed. Use one of: {{allowed}}.',
      missingWrapperPattern: 'field-factory tier requires `@dbxFormWrapperPattern <unwrapped|material-form-field-wrapped>`.',
      invalidWrapperPattern: '`@dbxFormWrapperPattern` value `{{value}}` is not allowed. Use one of: {{allowed}}.',
      missingNgFormType: 'field-factory tier requires `@dbxFormNgFormType <type>`.',
      missingSuffix: 'composite-builder tier requires `@dbxFormSuffix <Row|Group|Fields|Field|Wrapper|Layout>`.',
      invalidSuffix: '`@dbxFormSuffix` value `{{value}}` is not allowed. Use one of: {{allowed}}.',
      missingComposesFrom: '`@dbxFormFieldDerivative` / `@dbxFormFieldTemplate` require `@dbxFormComposesFrom <slug,...>`.',
      composesFromNotKebab: '`@dbxFormComposesFrom` item `{{value}}` is not a kebab-case slug.',
      unknownDbxFormTag: '`@dbxForm{{name}}` is not a recognized companion tag. Known companions: {{known}}.',
      duplicateCompanionTag: '`@dbxForm{{name}}` is declared more than once.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          allowedTiers: { type: 'array' as const, items: { type: 'string' as const } },
          allowedWrapperPatterns: { type: 'array' as const, items: { type: 'string' as const } },
          allowedSuffixes: { type: 'array' as const, items: { type: 'string' as const } },
          allowedArrayOutputs: { type: 'array' as const, items: { type: 'string' as const } },
          knownCompanions: { type: 'array' as const, items: { type: 'string' as const } },
          requireBareMarker: { type: 'boolean' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const sourceCode = context.sourceCode;
    const allowedTiers = options.allowedTiers ?? DEFAULT_ALLOWED_TIERS;
    const allowedWrapperPatterns = options.allowedWrapperPatterns ?? DEFAULT_ALLOWED_WRAPPER_PATTERNS;
    const allowedSuffixes = options.allowedSuffixes ?? DEFAULT_ALLOWED_SUFFIXES;
    const allowedArrayOutputs = options.allowedArrayOutputs ?? DEFAULT_ALLOWED_ARRAY_OUTPUTS;
    const knownCompanions = options.knownCompanions ?? DEFAULT_KNOWN_COMPANIONS;
    const requireBareMarker = options.requireBareMarker !== false;

    function checkJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const { markers, companions } = collectFormTags(parsed);
      if ((markers.length === 0 && companions.size === 0) || (requireBareMarker && markers.length === 0)) return;

      const ctx: FormReportContext = { commentNode, parsed, sourceCode, report: context.report };
      const triggerLine = markers[0]?.startLineIndex ?? 0;

      reportFormDuplicateMarkers(ctx, markers);
      reportFormUnknownCompanions(ctx, companions, knownCompanions);
      reportFormDuplicateCompanions(ctx, companions);
      reportFormSlug(ctx, companions.get('Slug') ?? [], triggerLine);
      reportFormProduces(ctx, companions.get('Produces') ?? [], triggerLine);
      reportFormArrayOutput({ ctx, arrayOutputTags: companions.get('ArrayOutput') ?? [], allowedArrayOutputs, triggerLine });

      const tierTags = companions.get('Tier') ?? [];
      const tier = determineTier(markers, tierTags);
      reportFormTier({ ctx, markers, tierTags, tier, allowedTiers, triggerLine });

      const composesFromTags = companions.get('ComposesFrom') ?? [];
      if (tier === 'field-factory') {
        reportFormFieldFactoryTier({ ctx, companions, allowedWrapperPatterns, triggerLine });
      } else if (tier === 'composite-builder') {
        reportFormCompositeBuilderTier({ ctx, suffixTags: companions.get('Suffix') ?? [], allowedSuffixes, triggerLine });
      } else if (tier === 'field-derivative' || tier === 'template-builder') {
        reportFormDerivativeTier({ ctx, markers, composesFromTags, triggerLine });
      }

      reportFormComposesFromKebab(ctx, composesFromTags, markers);
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
