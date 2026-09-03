import { type AstNode } from './util';
import type { Maybe } from '@dereekb/util';
import { DBX_ACTION_ERROR_DIRECTIVE_SELECTORS, DBX_ACTION_HANDLER_SELECTOR, DBX_ACTION_SOURCE_SELECTOR, DBX_ACTION_TRIGGER_SELECTORS, actionElementLoc, collectActionContext, getTemplateParserServices, hasTokenOnSelfOrAncestor, isActionHost } from './dbx-action.template-util';

/**
 * ESLint rule definition shape used by `require-action-error-handler`.
 */
export interface DbxWebRequireActionErrorHandlerRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly missingErrorHandler: string;
    };
    readonly schema: readonly object[];
  };
  create(context: AstNode): Record<string, (node: AstNode) => void>;
}

/**
 * Token the autofix appends to an action host that presents no errors.
 */
const DBX_ACTION_ERROR_FIX_TOKEN = 'dbxActionSnackbarError';

/**
 * Builds the fix that appends {@link DBX_ACTION_ERROR_FIX_TOKEN} to the action host's
 * start tag, inserting just inside the closing `>` (or before the `/` of a
 * self-closing `/>`).
 *
 * Returns `null` — declining to fix — whenever the start tag is not shaped the way
 * this expects, so a malformed or unexpected template is left alone rather than
 * rewritten on a guess.
 *
 * @param context - The rule context, used for the template source text.
 * @param node - The action host element being reported.
 * @param fixer - The ESLint fixer.
 * @returns The fix, or null when the start tag could not be located.
 */
function actionErrorDirectiveFix(context: AstNode, node: AstNode, fixer: AstNode): Maybe<AstNode> {
  const startSpan = node.startSourceSpan;
  const text: string | undefined = context.sourceCode?.getText?.();
  let result: Maybe<AstNode> = null;

  if (startSpan && text) {
    const closeOffset = startSpan.end.offset - 1;

    if (text[closeOffset] === '>') {
      // step back over the '/' of a self-closing tag so the token lands inside the tag
      let insertAt = text[closeOffset - 1] === '/' ? closeOffset - 1 : closeOffset;

      // then back over any trailing whitespace, so the token appends directly after the
      // last attribute rather than doubling a space or landing past a newline-indented '>'
      while (insertAt > 0 && /\s/.test(text[insertAt - 1] as string)) {
        insertAt -= 1;
      }

      result = fixer.replaceTextRange([insertAt, insertAt], ` ${DBX_ACTION_ERROR_FIX_TOKEN}`);
    }
  }

  return result;
}

/**
 * ESLint (Angular template) rule that flags a `dbxAction` which runs work (has a
 * handler or a trigger) but presents no errors to the user.
 *
 * Satisfied by ANY error directive in the context: `dbxActionSnackbarError`,
 * `[dbxActionError]`, `[dbxActionSnackbar]`, or `[dbxActionErrorHandler]`.
 *
 * Shares the same context-scoping bail conditions as `require-action-value-source`
 * (`[dbxActionSource]` on self/ancestor, or a nested `dbxAction`).
 *
 * The autofix appends the bare `dbxActionSnackbarError` token to the action host's
 * start tag — the canonical default, and the form every compliant call site uses.
 *
 * IMPORTANT: `DbxActionSnackbarErrorDirective` is a standalone directive from
 * `@dereekb/dbx-web`, so the fix is only complete once the component also lists it
 * in `imports`. A template fixer cannot add that (for an external `.html` the
 * imports live in a different file entirely), and Angular does NOT reject an
 * unmatched bare attribute — it degrades to an inert DOM attribute. So `--fix`
 * silences this rule whether or not the import lands. Always add the import
 * alongside the fix, and prefer `dbxActionErrorHandler` (which lives in
 * `@dereekb/dbx-core`) wherever a dbx-web dependency would be a layering violation.
 */
export const DBX_WEB_REQUIRE_ACTION_ERROR_HANDLER_RULE: DbxWebRequireActionErrorHandlerRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require an error-presentation directive on a dbxAction that runs a handler so failures surface to the user.',
      recommended: false
    },
    messages: {
      missingErrorHandler: '`dbxAction` runs a handler but surfaces no errors to the user. Add `dbxActionSnackbarError` (or `[dbxActionError]`, `[dbxActionSnackbar]`, or `[dbxActionErrorHandler]`) so action failures are presented.'
    },
    schema: []
  },
  create(context: AstNode) {
    const parserServices = getTemplateParserServices(context);

    return {
      Element(node: AstNode) {
        if (!parserServices?.convertNodeSourceSpanToLoc) {
          return; // not an Angular template (no template parser services)
        }

        if (!isActionHost(node)) {
          return;
        }

        if (hasTokenOnSelfOrAncestor(node, DBX_ACTION_SOURCE_SELECTOR)) {
          return; // forwarded external context — error handling may live elsewhere
        }

        const { tokens, nestedAction } = collectActionContext(node);

        if (nestedAction) {
          return; // multiple action contexts — ambiguous
        }

        const hasHandlerOrTrigger = tokens.has(DBX_ACTION_HANDLER_SELECTOR) || DBX_ACTION_TRIGGER_SELECTORS.some((selector) => tokens.has(selector));

        if (!hasHandlerOrTrigger) {
          return; // nothing actionable here — skip
        }

        const hasErrorDirective = DBX_ACTION_ERROR_DIRECTIVE_SELECTORS.some((selector) => tokens.has(selector));

        if (!hasErrorDirective) {
          context.report({
            loc: actionElementLoc(parserServices, node),
            messageId: 'missingErrorHandler',
            fix: (fixer: AstNode) => actionErrorDirectiveFix(context, node, fixer)
          });
        }
      }
    };
  }
};
