import { leadingJsdocFor } from './comments';
import type { Maybe } from '@dereekb/util';
import { parseJsdocComment, type ParsedJsdoc, type ParsedJsdocTag } from './jsdoc-parser';
import { KEBAB_SLUG_PATTERN, reportOnJsdocLine, splitCommaSeparated } from './dbx-tag-families';

type AstNode = any;

const DEFAULT_ALLOWED_ROLES: readonly string[] = ['directive', 'store'];
const DEFAULT_ALLOWED_STATES: readonly string[] = ['IDLE', 'DISABLED', 'TRIGGERED', 'VALUE_READY', 'WORKING', 'RESOLVED', 'REJECTED'];
const DEFAULT_KNOWN_COMPANIONS: readonly string[] = ['Slug', 'Role', 'StateInteraction', 'ProducesContext', 'ConsumesContext', 'SkillRefs', 'DisabledKey', 'StateEnum', 'StateTransitionsFrom', 'StateTransitionsTo'];

/**
 * Splits an `@dbxAction`-family JSDoc into its marker tag and the map of
 * companion tags keyed by their suffix (e.g. `Slug`, `Role`).
 *
 * @param parsed - The parsed JSDoc to inspect.
 * @returns The marker tag (if any) and a map of companion suffix to tag instances.
 */
function collectFamilyTags(parsed: ParsedJsdoc): { readonly markerTag: Maybe<ParsedJsdocTag>; readonly companions: ReadonlyMap<string, ParsedJsdocTag[]> } {
  const markerTag = parsed.tags.find((t) => t.tag === 'dbxAction');
  const groups = new Map<string, ParsedJsdocTag[]>();
  for (const tag of parsed.tags) {
    if (!tag.tag.startsWith('dbxAction') || tag.tag === 'dbxAction') continue;
    const suffix = tag.tag.slice('dbxAction'.length);
    const list = groups.get(suffix) ?? [];
    list.push(tag);
    groups.set(suffix, list);
  }
  return { markerTag, companions: groups };
}

/**
 * Options for the require-dbx-action-companion-tags rule.
 */
export interface UtilRequireDbxActionCompanionTagsRuleOptions {
  readonly allowedRoles?: readonly string[];
  readonly allowedStates?: readonly string[];
  readonly knownCompanions?: readonly string[];
  readonly requireBareMarker?: boolean;
}

/**
 * ESLint rule definition for require-dbx-action-companion-tags.
 */
export interface UtilRequireDbxActionCompanionTagsRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireDbxActionCompanionTagsRuleOptions[]; report: (descriptor: { loc?: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule enforcing `@dbxAction` companion tags. Mirrors the scanner
 * schema at `packages/dbx-components-mcp/src/scan/actions-extract.ts`. Class
 * declarations carry the `@dbxAction` marker; enum declarations carry the
 * `@dbxActionStateEnum` marker, and `@dbxActionStateTransitionsFrom/To` are
 * valid on enum-member JSDocs.
 */
export const utilRequireDbxActionCompanionTagsRule: UtilRequireDbxActionCompanionTagsRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require the canonical `@dbxAction*` companion tags on `@dbxAction`-tagged classes and `@dbxActionStateEnum`-tagged enums.',
      recommended: true
    },
    messages: {
      missingSlug: '`@dbxAction`-tagged class is missing the required `@dbxActionSlug <slug>` companion tag.',
      invalidSlugFormat: '`@dbxActionSlug` value `{{value}}` is not a valid kebab-case slug.',
      invalidRole: '`@dbxActionRole` value `{{value}}` is not allowed. Use one of: {{allowed}}.',
      invalidStateValue: '`@dbxActionStateInteraction` value `{{value}}` is not a valid state. Use one of: {{allowed}}.',
      skillRefsNotKebab: '`@dbxActionSkillRefs` item `{{value}}` is not a kebab-case slug.',
      stateTagOutsideEnumMember: '`@dbxAction{{name}}` is only valid on enum members of a `@dbxActionStateEnum`-tagged enum.',
      unknownDbxActionTag: '`@dbxAction{{name}}` is not a recognized companion tag. Known companions: {{known}}.',
      duplicateCompanionTag: '`@dbxAction{{name}}` is declared more than once.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          allowedRoles: { type: 'array' as const, items: { type: 'string' as const } },
          allowedStates: { type: 'array' as const, items: { type: 'string' as const } },
          knownCompanions: { type: 'array' as const, items: { type: 'string' as const } },
          requireBareMarker: { type: 'boolean' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const sourceCode = context.sourceCode;
    const allowedRoles = options.allowedRoles ?? DEFAULT_ALLOWED_ROLES;
    const allowedStates = options.allowedStates ?? DEFAULT_ALLOWED_STATES;
    const knownCompanions = options.knownCompanions ?? DEFAULT_KNOWN_COMPANIONS;
    const requireBareMarker = options.requireBareMarker !== false;
    const propertyOnlyCompanions: ReadonlySet<string> = new Set(['StateTransitionsFrom', 'StateTransitionsTo']);

    function checkClassJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const { markerTag, companions } = collectFamilyTags(parsed);
      if ((!markerTag && companions.size === 0) || (requireBareMarker && !markerTag)) return;
      const triggerLine = (markerTag ?? Array.from(companions.values())[0]?.[0])?.startLineIndex ?? 0;

      // Unknown companions.
      for (const [suffix, instances] of companions.entries()) {
        if (!knownCompanions.includes(suffix)) {
          for (const tag of instances) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'unknownDbxActionTag', data: { name: suffix, known: knownCompanions.join(', ') }, report: context.report });
        }
        if (propertyOnlyCompanions.has(suffix)) {
          for (const tag of instances) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'stateTagOutsideEnumMember', data: { name: suffix }, report: context.report });
        }
      }

      // Duplicate detection (only for non-multiple companions).
      for (const [suffix, instances] of companions.entries()) {
        if (instances.length <= 1) continue;
        for (let i = 1; i < instances.length; i += 1) {
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: instances[i].startLineIndex, messageId: 'duplicateCompanionTag', data: { name: suffix }, report: context.report });
        }
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

      // Role enum.
      const roleTags = companions.get('Role') ?? [];
      for (const tag of roleTags) {
        const value = tag.description.trim();
        if (value.length > 0 && !allowedRoles.includes(value)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'invalidRole', data: { value, allowed: allowedRoles.join(', ') }, report: context.report });
      }

      // StateInteraction list values.
      for (const tag of companions.get('StateInteraction') ?? []) {
        for (const item of splitCommaSeparated(tag.description)) {
          if (!allowedStates.includes(item)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'invalidStateValue', data: { value: item, allowed: allowedStates.join(', ') }, report: context.report });
        }
      }

      // SkillRefs kebab.
      for (const tag of companions.get('SkillRefs') ?? []) {
        for (const item of splitCommaSeparated(tag.description)) {
          if (!KEBAB_SLUG_PATTERN.test(item)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'skillRefsNotKebab', data: { value: item }, report: context.report });
        }
      }
    }

    function checkEnumMemberJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const fromTags = parsed.tags.filter((t) => t.tag === 'dbxActionStateTransitionsFrom');
      const toTags = parsed.tags.filter((t) => t.tag === 'dbxActionStateTransitionsTo');
      for (const tag of [...fromTags, ...toTags]) {
        for (const item of splitCommaSeparated(tag.description)) {
          if (!allowedStates.includes(item)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'invalidStateValue', data: { value: item, allowed: allowedStates.join(', ') }, report: context.report });
        }
      }
    }

    function visitClass(node: AstNode): void {
      const anchor = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
      const jsdoc = leadingJsdocFor(sourceCode, anchor);
      if (jsdoc) checkClassJsdoc(jsdoc);
    }

    function visitEnumMember(node: AstNode): void {
      const jsdoc = leadingJsdocFor(sourceCode, node);
      if (jsdoc) checkEnumMemberJsdoc(jsdoc);
    }

    return {
      ClassDeclaration: visitClass,
      TSEnumMember: visitEnumMember
    };
  }
};
