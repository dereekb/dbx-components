import { type AstNode } from './util';
import { DBX_ACTION_ERROR_DIRECTIVE_SELECTORS, DBX_ACTION_HANDLER_SELECTOR, DBX_ACTION_SOURCE_SELECTOR, DBX_ACTION_TRIGGER_SELECTORS, actionElementLoc, collectActionContext, getTemplateParserServices, hasTokenOnSelfOrAncestor, isActionHost } from './dbx-action.template-util';

/**
 * ESLint rule definition shape used by `require-action-error-handler`.
 */
export interface DbxWebRequireActionErrorHandlerRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: undefined;
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
 * ESLint (Angular template) rule that flags a `dbxAction` which runs work (has a
 * handler or a trigger) but presents no errors to the user.
 *
 * Satisfied by ANY error directive in the context: `dbxActionSnackbarError`,
 * `[dbxActionError]`, `[dbxActionSnackbar]`, or `[dbxActionErrorHandler]`.
 *
 * Shares the same context-scoping bail conditions as `require-action-value-source`
 * (`[dbxActionSource]` on self/ancestor, or a nested `dbxAction`).
 */
export const DBX_WEB_REQUIRE_ACTION_ERROR_HANDLER_RULE: DbxWebRequireActionErrorHandlerRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: undefined,
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
            messageId: 'missingErrorHandler'
          });
        }
      }
    };
  }
};
