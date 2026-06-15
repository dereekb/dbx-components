/**
 * ESLint rule that validates `@dbxRouteModel` / `@dbxRouteModelList` JSDoc tag
 * grammar at author time. Each tag is parsed through `@dereekb/dbx-cli`'s
 * canonical {@link parseRouteModelTag} grammar — the exact parser the build-time
 * route-manifest builder uses — so ESLint and the manifest generator can never
 * disagree about what a valid tag is. A malformed tag (typo'd model type, bad
 * key template, wrong token count, unknown `@dbxRouteModel*` name) is reported on
 * its own JSDoc line with the parser's failure reason.
 *
 * Scope: route-model tags live on `@Component` classes in `*.component.ts` and on
 * exported `Ng2StateDeclaration` consts in `*.router.ts`, so the rule visits class
 * and variable declarations (anchoring to their `export` wrapper for the leading
 * JSDoc). It has no auto-fix — the correct value requires human / agent judgment.
 */

import { leadingJsdocFor, parseJsdocComment, reportOnJsdocLine, type ParsedJsdocTag } from '@dereekb/util/eslint';
import { parseRouteModelTag, ROUTE_MODEL_TAG, type RawRouteModelTag } from '@dereekb/dbx-cli';

interface AstNode {
  readonly type: string;
  [key: string]: any;
}

/**
 * ESLint rule definition for valid-dbx-route-model-tags.
 */
export interface DbxCliValidDbxRouteModelTagsRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { report: (descriptor: { loc?: AstNode; node?: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule enforcing that `@dbxRouteModel` / `@dbxRouteModelList` tags parse
 * cleanly through the canonical route-model grammar. Reuses
 * {@link parseRouteModelTag} from `@dereekb/dbx-cli` so a tag that lints clean is
 * a tag the build-time manifest builder will accept.
 *
 * Checks (delegated to the grammar parser):
 *
 * - `@dbxRouteModel <modelType> <keyTemplate>` has exactly two tokens with a valid
 *   model-type identifier and a parseable key template (`:param` / `{authUid}` /
 *   even-segment `gb/:id/...` form).
 * - `@dbxRouteModelList <modelType>` has a single valid model-type token.
 * - A `@dbxRouteModel*` tag with an unknown name is flagged.
 *
 * Report-only — no auto-fix, since the corrected value needs judgment.
 */
export const DBX_CLI_VALID_DBX_ROUTE_MODEL_TAGS_RULE: DbxCliValidDbxRouteModelTagsRuleDefinition = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate `@dbxRouteModel` / `@dbxRouteModelList` JSDoc tag grammar against the canonical route-model parser.',
      recommended: true
    },
    messages: {
      malformedRouteModelTag: 'Malformed `@dbxRouteModel*` tag: {{reason}}'
    },
    schema: []
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const checkedComments = new WeakSet<AstNode>();

    function checkJsdoc(commentNode: AstNode): void {
      if (checkedComments.has(commentNode)) {
        return;
      }
      checkedComments.add(commentNode);

      const parsed = parseJsdocComment(commentNode.value);
      for (const tag of parsed.tags as readonly ParsedJsdocTag[]) {
        if (!tag.tag.startsWith(ROUTE_MODEL_TAG)) {
          continue;
        }
        const raw: RawRouteModelTag = { name: tag.tag, text: tag.description.trim() };
        const result = parseRouteModelTag(raw);
        if (!result.ok) {
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: tag.startLineIndex, messageId: 'malformedRouteModelTag', data: { reason: result.message }, report: context.report });
        }
      }
    }

    function visit(node: AstNode, anchorParentTypes: readonly string[]): void {
      const anchor = node.parent && anchorParentTypes.includes(node.parent.type) ? node.parent : node;
      const jsdoc = leadingJsdocFor(sourceCode, anchor);
      if (jsdoc) {
        checkJsdoc(jsdoc);
      }
    }

    const exportAnchors: readonly string[] = ['ExportNamedDeclaration', 'ExportDefaultDeclaration'];

    return {
      ClassDeclaration: (node: AstNode) => visit(node, exportAnchors),
      VariableDeclaration: (node: AstNode) => visit(node, exportAnchors)
    };
  }
};
