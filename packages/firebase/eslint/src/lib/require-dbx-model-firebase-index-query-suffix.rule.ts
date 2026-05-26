import type { Maybe } from '@dereekb/util';
import { leadingJsdocFor, parseJsdocComment } from '@dereekb/util/eslint';
import { type AstNode, DBX_MODEL_FIREBASE_INDEX_MARKER, QUERY_SUFFIX, getFunctionJsdocAnchor, getFunctionName, getFunctionNameNode } from './util';

/**
 * Options for the require-dbx-model-firebase-index-query-suffix rule.
 */
export interface FirebaseRequireDbxModelFirebaseIndexQuerySuffixRuleOptions {
  readonly suffix?: string;
  readonly markerTag?: string;
  readonly allowedSuffixes?: readonly string[];
  readonly strippableSuffixes?: readonly string[];
}

/**
 * ESLint rule definition for require-dbx-model-firebase-index-query-suffix.
 */
export interface FirebaseRequireDbxModelFirebaseIndexQuerySuffixRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebaseRequireDbxModelFirebaseIndexQuerySuffixRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

const DEFAULT_STRIPPABLE_SUFFIXES: readonly string[] = ['Filter', 'Constraints', 'Builder'];

/**
 * Builds a rename suggestion: strips a recognized non-canonical suffix and appends the canonical
 * `Query` suffix; otherwise appends `Query` directly.
 *
 * @param name - The current function name.
 * @param suffix - The canonical suffix (default `'Query'`).
 * @param strippable - Suffixes to strip before appending (default `['Filter', 'Constraints', 'Builder']`).
 * @returns The suggested renamed identifier.
 */
function buildRenameSuggestion(name: string, suffix: string, strippable: readonly string[]): string {
  let result = `${name}${suffix}`;
  for (const s of strippable) {
    if (name.endsWith(s) && name.length > s.length) {
      result = `${name.slice(0, -s.length)}${suffix}`;
      break;
    }
  }
  return result;
}

/**
 * ESLint rule that enforces the canonical `Query` suffix on every `@dbxModelFirebaseIndex`-tagged
 * function. Mirrors the naming used by the canonical fixtures in
 * `packages/dbx-components-mcp/src/scan/model-firebase-index-extract.spec.ts` and production
 * factories in `packages/firebase/src/lib/model/**\/*.query.ts`.
 *
 * Not auto-fixable: renaming across files (call sites + tests) is outside the safe scope of an
 * ESLint autofix.
 */
export const FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_QUERY_SUFFIX_RULE: FirebaseRequireDbxModelFirebaseIndexQuerySuffixRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: undefined,
    docs: {
      description: 'Require the canonical `Query` suffix on `@dbxModelFirebaseIndex`-tagged factories.',
      recommended: true
    },
    messages: {
      queryFactoryNameMustEndWithQuery: '`@dbxModelFirebaseIndex`-tagged factory `{{name}}` must end with `{{suffix}}`. Rename to e.g. `{{suggestion}}` so dbx-components-mcp can identify it consistently.',
      anonymousQueryFactory: '`@dbxModelFirebaseIndex`-tagged factories must be named (must end with `{{suffix}}`); anonymous functions are not allowed.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          suffix: { type: 'string' as const },
          markerTag: { type: 'string' as const },
          allowedSuffixes: { type: 'array' as const, items: { type: 'string' as const } },
          strippableSuffixes: { type: 'array' as const, items: { type: 'string' as const } }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const sourceCode = context.sourceCode;
    const suffix = options.suffix ?? QUERY_SUFFIX;
    const markerTag = options.markerTag ?? DBX_MODEL_FIREBASE_INDEX_MARKER;
    const allowedSuffixes: readonly string[] = options.allowedSuffixes ?? [];
    const strippableSuffixes: readonly string[] = options.strippableSuffixes ?? DEFAULT_STRIPPABLE_SUFFIXES;

    function isTagged(anchor: AstNode): boolean {
      const jsdoc = leadingJsdocFor(sourceCode, anchor);
      let result = false;
      if (jsdoc) {
        const parsed = parseJsdocComment(jsdoc.value);
        result = parsed.tags.some((t) => t.tag === markerTag);
      }
      return result;
    }

    function nameMatchesSuffix(name: string): boolean {
      let matches = name.endsWith(suffix);
      if (!matches) {
        for (const allowed of allowedSuffixes) {
          if (name.endsWith(allowed)) {
            matches = true;
            break;
          }
        }
      }
      return matches;
    }

    function check(node: AstNode): void {
      const anchor = getFunctionJsdocAnchor(node);
      if (!anchor || !isTagged(anchor)) return;

      const name: Maybe<string> = getFunctionName(node);
      if (!name) {
        context.report({ node: getFunctionNameNode(node), messageId: 'anonymousQueryFactory', data: { suffix } });
        return;
      }
      if (!nameMatchesSuffix(name)) {
        const suggestion = buildRenameSuggestion(name, suffix, strippableSuffixes);
        context.report({ node: getFunctionNameNode(node), messageId: 'queryFactoryNameMustEndWithQuery', data: { name, suffix, suggestion } });
      }
    }

    return {
      FunctionDeclaration: (node: AstNode) => check(node),
      FunctionExpression: (node: AstNode) => check(node),
      ArrowFunctionExpression: (node: AstNode) => check(node)
    };
  }
};
