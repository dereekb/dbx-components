import { leadingJsdocFor } from './comments';
import type { Maybe } from '@dereekb/util';
import { parseJsdocComment, type ParsedJsdoc, type ParsedJsdocTag } from './jsdoc-parser';
import { PASCAL_IDENTIFIER_PATTERN, reportOnJsdocLine } from './dbx-tag-families';

interface AstNode {
  readonly type: string;
  [key: string]: any;
}

const MODEL_MARKERS: ReadonlySet<string> = new Set(['dbxModel', 'dbxModelSubObject', 'dbxModelOrganizationalGroupRoot', 'dbxModelGroup']);
const EXCLUSIVE_MODEL_MARKERS: ReadonlySet<string> = new Set(['dbxModel', 'dbxModelSubObject', 'dbxModelOrganizationalGroupRoot']);
const MODEL_COMPANIONS: readonly string[] = ['Archetype', 'AggregatesFrom', 'CompositeKey'];
const PROPERTY_COMPANIONS: readonly string[] = ['Variable', 'VariableSyncFlag'];
const DEFAULT_ALLOWED_ENCODINGS: readonly string[] = ['two-way', 'one-way'];
const ARCHETYPE_SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;
const ARCHETYPE_AXIS_PATTERN = /^([A-Za-z_$][A-Za-z0-9_$]*)=([^,]+)$/;

interface ModelReportContext {
  readonly commentNode: AstNode;
  readonly parsed: ParsedJsdoc;
  readonly sourceCode: AstNode;
  readonly report: (descriptor: { loc?: AstNode; messageId: string; data?: Record<string, string> }) => void;
}

function reportMutuallyExclusiveMarkers(ctx: ModelReportContext, markers: readonly ParsedJsdocTag[]): void {
  const exclusiveMarkers = markers.filter((m) => EXCLUSIVE_MODEL_MARKERS.has(m.tag));
  if (exclusiveMarkers.length <= 1) return;
  for (let i = 1; i < exclusiveMarkers.length; i += 1) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: exclusiveMarkers[i].startLineIndex, messageId: 'mutuallyExclusiveMarkers', report: ctx.report });
  }
}

function reportPropertyOnlyTags(ctx: ModelReportContext, companions: ReadonlyMap<string, ParsedJsdocTag[]>): void {
  for (const propOnly of PROPERTY_COMPANIONS) {
    for (const tag of companions.get(propOnly) ?? []) {
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tag.startLineIndex, messageId: 'variableTagOutsideProperty', data: { name: propOnly }, report: ctx.report });
    }
  }
}

function reportUnknownModelCompanions(ctx: ModelReportContext, companions: ReadonlyMap<string, ParsedJsdocTag[]>, knownCompanions: readonly string[]): void {
  for (const [suffix, instances] of companions.entries()) {
    if (PROPERTY_COMPANIONS.includes(suffix)) continue;
    if (knownCompanions.includes(suffix)) continue;
    for (const tag of instances) {
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tag.startLineIndex, messageId: 'unknownDbxModelTag', data: { name: suffix, known: knownCompanions.join(', ') }, report: ctx.report });
    }
  }
}

function reportModelDuplicates(ctx: ModelReportContext, companions: ReadonlyMap<string, ParsedJsdocTag[]>, knownCompanions: readonly string[]): void {
  for (const suffix of knownCompanions) {
    if (suffix === 'Archetype') continue; // archetypes are repeatable.
    const instances = companions.get(suffix) ?? [];
    if (instances.length <= 1) continue;
    for (let i = 1; i < instances.length; i += 1) {
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: instances[i].startLineIndex, messageId: 'duplicateCompanionTag', data: { name: suffix }, report: ctx.report });
    }
  }
}

function reportArchetypeTag(ctx: ModelReportContext, tag: ParsedJsdocTag): void {
  const text = tag.description.trim();
  if (text.length === 0) return;
  const spaceIdx = text.indexOf(' ');
  const slug = spaceIdx >= 0 ? text.slice(0, spaceIdx).trim() : text;
  if (!ARCHETYPE_SLUG_PATTERN.test(slug)) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tag.startLineIndex, messageId: 'archetypeBadSlug', data: { value: slug }, report: ctx.report });
    return;
  }
  if (spaceIdx < 0) return;
  const rest = text.slice(spaceIdx + 1).trim();
  for (const pair of rest.split(',')) {
    const trimmed = pair.trim();
    if (trimmed.length === 0) continue;
    if (!ARCHETYPE_AXIS_PATTERN.test(trimmed)) {
      reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tag.startLineIndex, messageId: 'archetypeBadAxisPair', data: { value: trimmed }, report: ctx.report });
    }
  }
}

function reportCompositeKeyTag(ctx: ModelReportContext, tag: ParsedJsdocTag, allowedEncodings: readonly string[]): void {
  const text = tag.description.trim();
  if (text.length === 0) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tag.startLineIndex, messageId: 'compositeKeyMissingFrom', report: ctx.report });
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tag.startLineIndex, messageId: 'compositeKeyMissingEncoding', report: ctx.report });
    return;
  }
  let hasFrom = false;
  let encoding: Maybe<string>;
  for (const token of text.split(/\s+/)) {
    const eq = token.indexOf('=');
    if (eq <= 0) continue;
    const key = token.slice(0, eq).trim();
    const value = token.slice(eq + 1).trim();
    if (key === 'from' && value.length > 0) hasFrom = true;
    else if (key === 'encoding') encoding = value;
  }
  if (!hasFrom) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tag.startLineIndex, messageId: 'compositeKeyMissingFrom', report: ctx.report });
  }
  if (encoding == null) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tag.startLineIndex, messageId: 'compositeKeyMissingEncoding', report: ctx.report });
  } else if (!allowedEncodings.includes(encoding)) {
    reportOnJsdocLine({ commentNode: ctx.commentNode, parsed: ctx.parsed, sourceCode: ctx.sourceCode, lineIndex: tag.startLineIndex, messageId: 'compositeKeyInvalidEncoding', data: { value: encoding, allowed: allowedEncodings.join(', ') }, report: ctx.report });
  }
}

/**
 * Splits an interface JSDoc into the marker tags from `MODEL_MARKERS` and the
 * map of `@dbxModel*` companion tags keyed by suffix. Property-only companions
 * (`Variable`, `VariableSyncFlag`) are still surfaced so the caller can flag them
 * as misplaced when found on an interface JSDoc.
 *
 * @param parsed - The parsed JSDoc to inspect.
 * @returns The list of marker tags and the map of companion suffix to tag instances.
 */
function collectInterfaceTags(parsed: ParsedJsdoc): { readonly markers: ParsedJsdocTag[]; readonly companions: Map<string, ParsedJsdocTag[]> } {
  const markers: ParsedJsdocTag[] = [];
  const companions = new Map<string, ParsedJsdocTag[]>();
  for (const tag of parsed.tags) {
    if (MODEL_MARKERS.has(tag.tag)) {
      markers.push(tag);
      continue;
    }
    // Property-level tags (Variable / VariableSyncFlag) on an interface JSDoc → misplaced.
    if (tag.tag === 'dbxModelVariable' || tag.tag === 'dbxModelVariableSyncFlag') {
      const suffix = tag.tag.slice('dbxModel'.length);
      const list = companions.get(suffix) ?? [];
      list.push(tag);
      companions.set(suffix, list);
      continue;
    }
    if (!tag.tag.startsWith('dbxModel')) continue;
    // Exclude tag prefixes that belong to sibling families (handled by their own rules).
    if (tag.tag.startsWith('dbxModelSnapshotField') || tag.tag.startsWith('dbxModelFirebaseIndex')) continue;
    const suffix = tag.tag.slice('dbxModel'.length);
    const list = companions.get(suffix) ?? [];
    list.push(tag);
    companions.set(suffix, list);
  }
  return { markers, companions };
}

/**
 * Options for the require-dbx-model-companion-tags rule.
 */
export interface UtilRequireDbxModelCompanionTagsRuleOptions {
  readonly allowedEncodings?: readonly string[];
  readonly knownCompanions?: readonly string[];
  readonly requireBareMarker?: boolean;
}

/**
 * ESLint rule definition for require-dbx-model-companion-tags.
 */
export interface UtilRequireDbxModelCompanionTagsRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireDbxModelCompanionTagsRuleOptions[]; report: (descriptor: { loc?: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule enforcing `@dbxModel` / `@dbxModelSubObject` / `@dbxModelOrganizationalGroupRoot`
 * companion tags. Mirrors the scanner schema at
 * `packages/dbx-components-mcp/src/scan/extract-models/find-interfaces.ts`.
 *
 * Does NOT enforce a Slug / Category / Tags shape because the scanner does
 * not consume those for this family.
 */
export const UTIL_REQUIRE_DBX_MODEL_COMPANION_TAGS_RULE: UtilRequireDbxModelCompanionTagsRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require the canonical `@dbxModel*` companion tags on `@dbxModel`-tagged interfaces.',
      recommended: true
    },
    messages: {
      archetypeBadSlug: '`@dbxModelArchetype` slug `{{value}}` is not a valid kebab-case slug.',
      archetypeBadAxisPair: '`@dbxModelArchetype` axis pair `{{value}}` is malformed; use `key=value` with non-empty key and value.',
      aggregatesFromNotPascalCase: '`@dbxModelAggregatesFrom` value `{{value}}` is not a PascalCase identifier.',
      compositeKeyMissingFrom: '`@dbxModelCompositeKey` is missing required `from=...` segment.',
      compositeKeyMissingEncoding: '`@dbxModelCompositeKey` is missing required `encoding=<two-way|one-way>` segment.',
      compositeKeyInvalidEncoding: '`@dbxModelCompositeKey` encoding `{{value}}` is invalid. Use one of: {{allowed}}.',
      mutuallyExclusiveMarkers: '`@dbxModel`, `@dbxModelSubObject`, and `@dbxModelOrganizationalGroupRoot` are mutually exclusive markers; only one is allowed.',
      variableTagOutsideProperty: '`@dbxModel{{name}}` is only valid on interface property declarations.',
      unknownDbxModelTag: '`@dbxModel{{name}}` is not a recognized companion tag. Known companions: {{known}}.',
      duplicateCompanionTag: '`@dbxModel{{name}}` is declared more than once.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          allowedEncodings: { type: 'array' as const, items: { type: 'string' as const } },
          knownCompanions: { type: 'array' as const, items: { type: 'string' as const } },
          requireBareMarker: { type: 'boolean' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const sourceCode = context.sourceCode;
    const allowedEncodings = options.allowedEncodings ?? DEFAULT_ALLOWED_ENCODINGS;
    const knownCompanions = options.knownCompanions ?? MODEL_COMPANIONS;
    const requireBareMarker = options.requireBareMarker !== false;

    function checkInterfaceJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const { markers, companions } = collectInterfaceTags(parsed);
      if ((markers.length === 0 && companions.size === 0) || (requireBareMarker && markers.length === 0)) return;

      const ctx: ModelReportContext = { commentNode, parsed, sourceCode, report: context.report };

      reportMutuallyExclusiveMarkers(ctx, markers);
      reportPropertyOnlyTags(ctx, companions);
      reportUnknownModelCompanions(ctx, companions, knownCompanions);
      reportModelDuplicates(ctx, companions, knownCompanions);

      for (const tag of companions.get('Archetype') ?? []) reportArchetypeTag(ctx, tag);

      for (const tag of companions.get('AggregatesFrom') ?? []) {
        const value = tag.description.trim().split(/\s+/)[0] ?? '';
        if (value.length > 0 && !PASCAL_IDENTIFIER_PATTERN.test(value)) {
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'aggregatesFromNotPascalCase', data: { value }, report: context.report });
        }
      }

      for (const tag of companions.get('CompositeKey') ?? []) reportCompositeKeyTag(ctx, tag, allowedEncodings);
    }

    function visitInterface(node: AstNode): void {
      const anchor = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
      const jsdoc = leadingJsdocFor(sourceCode, anchor);
      if (jsdoc) checkInterfaceJsdoc(jsdoc);
    }

    return {
      TSInterfaceDeclaration: visitInterface
    };
  }
};
