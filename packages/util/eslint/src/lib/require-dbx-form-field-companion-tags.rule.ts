import { getStatementAnchor, leadingJsdocFor } from './comments';
import type { Maybe } from '@dereekb/util';
import { parseJsdocComment, type ParsedJsdoc, type ParsedJsdocTag } from './jsdoc-parser';
import { KEBAB_SLUG_PATTERN, reportOnJsdocLine, splitCommaSeparated } from './dbx-tag-families';

type AstNode = any;

const FORM_MARKERS: readonly string[] = ['dbxFormField', 'dbxFormFieldDerivative', 'dbxFormFieldTemplate'];
const DEFAULT_ALLOWED_TIERS: readonly string[] = ['field-factory', 'field-derivative', 'composite-builder', 'template-builder', 'primitive'];
const DEFAULT_ALLOWED_WRAPPER_PATTERNS: readonly string[] = ['unwrapped', 'material-form-field-wrapped'];
const DEFAULT_ALLOWED_SUFFIXES: readonly string[] = ['Row', 'Group', 'Fields', 'Field', 'Wrapper', 'Layout'];
const DEFAULT_ALLOWED_ARRAY_OUTPUTS: readonly string[] = ['yes', 'no', 'optional'];
const DEFAULT_KNOWN_COMPANIONS: readonly string[] = ['Slug', 'Tier', 'Produces', 'ArrayOutput', 'WrapperPattern', 'NgFormType', 'Suffix', 'Returns', 'ComposesFrom', 'ConfigInterface', 'PropsInterface', 'Generic', 'PropName'];

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
 * schema at `packages/dbx-components-mcp/src/scan/forge-fields-extract.ts`,
 * including the tier-conditional required-tag matrix.
 */
export const utilRequireDbxFormFieldCompanionTagsRule: UtilRequireDbxFormFieldCompanionTagsRuleDefinition = {
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

    function collectFormTags(parsed: ParsedJsdoc): { readonly markers: ParsedJsdocTag[]; readonly companions: Map<string, ParsedJsdocTag[]> } {
      const markers: ParsedJsdocTag[] = [];
      const companions = new Map<string, ParsedJsdocTag[]>();
      for (const tag of parsed.tags) {
        if (FORM_MARKERS.includes(tag.tag)) {
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

    function determineTier(markers: readonly ParsedJsdocTag[], tierTags: readonly ParsedJsdocTag[]): Maybe<string> {
      // Marker-derived tier takes precedence; `@dbxFormFieldDerivative` → 'field-derivative', `@dbxFormFieldTemplate` → 'template-builder'.
      // `@dbxFormField` requires an explicit `@dbxFormTier`.
      let derived: Maybe<string>;
      for (const m of markers) {
        if (m.tag === 'dbxFormFieldDerivative') derived = 'field-derivative';
        else if (m.tag === 'dbxFormFieldTemplate') derived = 'template-builder';
      }
      return derived !== undefined ? derived : tierTags.length > 0 ? tierTags[0].description.trim() : undefined;
    }

    function checkJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const { markers, companions } = collectFormTags(parsed);
      if ((markers.length === 0 && companions.size === 0) || (requireBareMarker && markers.length === 0)) return;
      const triggerLine = markers[0]?.startLineIndex ?? 0;

      // Mutually-exclusive markers.
      if (markers.length > 1) {
        for (let i = 1; i < markers.length; i += 1) {
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: markers[i].startLineIndex, messageId: 'duplicateMarker', report: context.report });
        }
      }

      // Unknown companions.
      for (const [suffix, instances] of companions.entries()) {
        if (!knownCompanions.includes(suffix)) {
          for (const tag of instances) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'unknownDbxFormTag', data: { name: suffix, known: knownCompanions.join(', ') }, report: context.report });
        }
      }

      // Duplicate detection.
      for (const [suffix, instances] of companions.entries()) {
        if (instances.length <= 1) continue;
        for (let i = 1; i < instances.length; i += 1) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: instances[i].startLineIndex, messageId: 'duplicateCompanionTag', data: { name: suffix }, report: context.report });
      }

      // Required Slug.
      const slugTags = companions.get('Slug') ?? [];
      if (slugTags.length === 0) {
        reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: triggerLine, messageId: 'missingSlug', report: context.report });
      } else {
        const value = slugTags[0].description.trim();
        if (value.length === 0) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: slugTags[0].startLineIndex, messageId: 'missingSlug', report: context.report });
        else if (!KEBAB_SLUG_PATTERN.test(value)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: slugTags[0].startLineIndex, messageId: 'invalidSlugFormat', data: { value }, report: context.report });
      }

      // Required Produces.
      const producesTags = companions.get('Produces') ?? [];
      if (producesTags.length === 0 || producesTags[0].description.trim().length === 0) {
        reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: triggerLine, messageId: 'missingProduces', report: context.report });
      }

      // Required ArrayOutput.
      const arrayOutputTags = companions.get('ArrayOutput') ?? [];
      if (arrayOutputTags.length === 0 || arrayOutputTags[0].description.trim().length === 0) {
        reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: triggerLine, messageId: 'missingArrayOutput', report: context.report });
      } else {
        const value = arrayOutputTags[0].description.trim();
        if (!allowedArrayOutputs.includes(value)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: arrayOutputTags[0].startLineIndex, messageId: 'invalidArrayOutput', data: { value, allowed: allowedArrayOutputs.join(', ') }, report: context.report });
      }

      // Tier resolution + tier-specific checks.
      const tierTags = companions.get('Tier') ?? [];
      const tier = determineTier(markers, tierTags);

      if (markers.some((m) => m.tag === 'dbxFormField')) {
        if (tier == null) {
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: triggerLine, messageId: 'missingTier', report: context.report });
        } else if (!allowedTiers.includes(tier)) {
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tierTags[0]?.startLineIndex ?? triggerLine, messageId: 'invalidTier', data: { value: tier, allowed: allowedTiers.join(', ') }, report: context.report });
        }
      }

      const composesFromTags = companions.get('ComposesFrom') ?? [];

      if (tier === 'field-factory') {
        const wrapperTags = companions.get('WrapperPattern') ?? [];
        if (wrapperTags.length === 0 || wrapperTags[0].description.trim().length === 0) {
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: triggerLine, messageId: 'missingWrapperPattern', report: context.report });
        } else {
          const value = wrapperTags[0].description.trim();
          if (!allowedWrapperPatterns.includes(value)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: wrapperTags[0].startLineIndex, messageId: 'invalidWrapperPattern', data: { value, allowed: allowedWrapperPatterns.join(', ') }, report: context.report });
        }
        const ngFormTags = companions.get('NgFormType') ?? [];
        if (ngFormTags.length === 0 || ngFormTags[0].description.trim().length === 0) {
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: triggerLine, messageId: 'missingNgFormType', report: context.report });
        }
      } else if (tier === 'composite-builder') {
        const suffixTags = companions.get('Suffix') ?? [];
        if (suffixTags.length === 0 || suffixTags[0].description.trim().length === 0) {
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: triggerLine, messageId: 'missingSuffix', report: context.report });
        } else {
          const value = suffixTags[0].description.trim();
          if (!allowedSuffixes.includes(value)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: suffixTags[0].startLineIndex, messageId: 'invalidSuffix', data: { value, allowed: allowedSuffixes.join(', ') }, report: context.report });
        }
      } else if (tier === 'field-derivative' || tier === 'template-builder') {
        // ComposesFrom required for these tiers (either explicit @dbxFormComposesFrom OR carried by the marker).
        const markerCarriesComposes = markers.some((m) => m.tag === 'dbxFormFieldDerivative' || m.tag === 'dbxFormFieldTemplate') && markers.some((m) => (m.tag === 'dbxFormFieldDerivative' || m.tag === 'dbxFormFieldTemplate') && m.description.trim().length > 0);
        if (composesFromTags.length === 0 && !markerCarriesComposes) {
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: triggerLine, messageId: 'missingComposesFrom', report: context.report });
        }
      }

      // ComposesFrom kebab validation (explicit @dbxFormComposesFrom only).
      for (const tag of composesFromTags) {
        for (const item of splitCommaSeparated(tag.description)) {
          if (!KEBAB_SLUG_PATTERN.test(item)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'composesFromNotKebab', data: { value: item }, report: context.report });
        }
      }
      // Also validate slugs carried on `@dbxFormFieldDerivative <slug>` / `@dbxFormFieldTemplate <slug,...>`.
      for (const m of markers) {
        if (m.tag === 'dbxFormFieldDerivative' || m.tag === 'dbxFormFieldTemplate') {
          for (const item of splitCommaSeparated(m.description)) {
            if (!KEBAB_SLUG_PATTERN.test(item)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: m.startLineIndex, messageId: 'composesFromNotKebab', data: { value: item }, report: context.report });
          }
        }
      }
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
