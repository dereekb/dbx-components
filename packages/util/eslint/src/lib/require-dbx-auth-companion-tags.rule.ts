import { leadingJsdocFor } from './comments';
import { parseJsdocComment } from './jsdoc-parser';
import { KEBAB_SLUG_PATTERN, reportOnJsdocLine, splitCommaSeparated } from './dbx-tag-families';

type AstNode = any;

const DEFAULT_KNOWN_COMPANIONS: readonly string[] = ['ClaimsApp', 'Claim', 'ClaimsService', 'Role', 'RoleTag'];

/**
 * Options for the require-dbx-auth-companion-tags rule.
 */
export interface UtilRequireDbxAuthCompanionTagsRuleOptions {
  readonly knownCompanions?: readonly string[];
  readonly requireBareMarker?: boolean;
}

/**
 * ESLint rule definition for require-dbx-auth-companion-tags.
 */
export interface UtilRequireDbxAuthCompanionTagsRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireDbxAuthCompanionTagsRuleOptions[]; report: (descriptor: { loc?: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule enforcing the three `@dbxAuth*` marker families. Mirrors the
 * scanner schema at `packages/dbx-components-mcp/src/scan/auth-extract.ts`.
 *
 * - `@dbxAuthClaimsApp <slug>` on an interface / type alias.
 * - `@dbxAuthClaim` (bare) on a `PropertySignature` inside an interface.
 * - `@dbxAuthClaimsService <slug>` on an exported `VariableDeclaration`.
 */
export const utilRequireDbxAuthCompanionTagsRule: UtilRequireDbxAuthCompanionTagsRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require the canonical `@dbxAuth*` companion tags on auth claims declarations.',
      recommended: true
    },
    messages: {
      appKeyMissing: '`@dbxAuthClaimsApp` requires a non-empty kebab-case app key value.',
      appKeyNotKebab: '`@dbxAuthClaimsApp` value `{{value}}` is not a valid kebab-case slug.',
      claimMarkerOutsideProperty: '`@dbxAuthClaim` is only valid on interface property declarations.',
      roleTagNotKebab: '`@dbxAuthRoleTag` item `{{value}}` is not a kebab-case slug.',
      serviceKeyMissing: '`@dbxAuthClaimsService` requires a non-empty kebab-case slug value.',
      serviceKeyNotKebab: '`@dbxAuthClaimsService` value `{{value}}` is not a valid kebab-case slug.',
      unknownDbxAuthTag: '`@dbxAuth{{name}}` is not a recognized companion tag. Known companions: {{known}}.',
      duplicateCompanionTag: '`@dbxAuth{{name}}` is declared more than once.'
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

    function checkInterfaceOrTypeJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const appTags = parsed.tags.filter((t) => t.tag === 'dbxAuthClaimsApp');
      const claimTags = parsed.tags.filter((t) => t.tag === 'dbxAuthClaim');
      if (appTags.length === 0 && claimTags.length === 0) return;

      for (const [i, tag] of appTags.entries()) {
        const value = tag.description.trim();
        if (value.length === 0) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'appKeyMissing', report: context.report });
        else if (!KEBAB_SLUG_PATTERN.test(value)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'appKeyNotKebab', data: { value }, report: context.report });
        if (i > 0) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'duplicateCompanionTag', data: { name: 'ClaimsApp' }, report: context.report });
      }
      // `@dbxAuthClaim` on an interface declaration is misplaced.
      for (const tag of claimTags) {
        reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'claimMarkerOutsideProperty', report: context.report });
      }
    }

    function checkPropertyJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const claimTags = parsed.tags.filter((t) => t.tag === 'dbxAuthClaim');
      const roleTags = parsed.tags.filter((t) => t.tag === 'dbxAuthRole');
      const roleTagTags = parsed.tags.filter((t) => t.tag === 'dbxAuthRoleTag');
      if (claimTags.length === 0 && roleTags.length === 0 && roleTagTags.length === 0) return;

      if (claimTags.length > 1) {
        for (let i = 1; i < claimTags.length; i += 1) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: claimTags[i].startLineIndex, messageId: 'duplicateCompanionTag', data: { name: 'Claim' }, report: context.report });
      }

      // `@dbxAuthRoleTag` items must be kebab.
      for (const tag of roleTagTags) {
        for (const item of splitCommaSeparated(tag.description)) {
          if (!KEBAB_SLUG_PATTERN.test(item)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'roleTagNotKebab', data: { value: item }, report: context.report });
        }
      }

      // Unknown @dbxAuth* tags on the property JSDoc.
      for (const tag of parsed.tags) {
        if (!tag.tag.startsWith('dbxAuth') || tag.tag === 'dbxAuthClaim') continue;
        const suffix = tag.tag.slice('dbxAuth'.length);
        if (!knownCompanions.includes(suffix)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'unknownDbxAuthTag', data: { name: suffix, known: knownCompanions.join(', ') }, report: context.report });
      }
    }

    function checkVariableJsdoc(commentNode: AstNode): void {
      const parsed = parseJsdocComment(commentNode.value);
      const serviceTags = parsed.tags.filter((t) => t.tag === 'dbxAuthClaimsService');
      if (serviceTags.length === 0) return;

      for (const [i, tag] of serviceTags.entries()) {
        const value = tag.description.trim();
        if (value.length === 0) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'serviceKeyMissing', report: context.report });
        else if (!KEBAB_SLUG_PATTERN.test(value)) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'serviceKeyNotKebab', data: { value }, report: context.report });
        if (i > 0) reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'duplicateCompanionTag', data: { name: 'ClaimsService' }, report: context.report });
      }
    }

    function visitInterfaceOrType(node: AstNode): void {
      const anchor = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
      const jsdoc = leadingJsdocFor(sourceCode, anchor);
      if (jsdoc) checkInterfaceOrTypeJsdoc(jsdoc);
    }

    function visitProperty(node: AstNode): void {
      const jsdoc = leadingJsdocFor(sourceCode, node);
      if (jsdoc) checkPropertyJsdoc(jsdoc);
    }

    function visitVariable(node: AstNode): void {
      const anchor = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
      const jsdoc = leadingJsdocFor(sourceCode, anchor);
      if (jsdoc) checkVariableJsdoc(jsdoc);
    }

    return {
      TSInterfaceDeclaration: visitInterfaceOrType,
      TSTypeAliasDeclaration: visitInterfaceOrType,
      TSPropertySignature: visitProperty,
      VariableDeclaration: visitVariable
    };
  }
};
