import { type AstNode } from './util';
import { DBX_ACTION_SOURCE_SELECTOR, DBX_ACTION_TRIGGER_SELECTORS, DBX_ACTION_VALUE_SOURCE_SELECTORS, actionElementLoc, collectActionContext, getTemplateParserServices, hasTokenOnSelfOrAncestor, isActionHost } from './dbx-action.template-util';

/**
 * ESLint rule definition shape used by `require-action-value-source`.
 */
export interface DbxWebRequireActionValueSourceRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: undefined;
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly missingValueSource: string;
    };
    readonly schema: readonly object[];
  };
  create(context: AstNode): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint (Angular template) rule that flags a `dbxAction` whose context has a
 * trigger but no value source.
 *
 * Such an action hangs: clicking the trigger moves the store to TRIGGERED, but with
 * nothing to call `readyValue()` it never advances to VALUE_READY, so the handler
 * never runs.
 *
 * Targets simple, inline cases only. It bails (does not report) when the value may
 * be supplied in a way a static template scan cannot see:
 * - `[dbxActionSource]` on the element or an ancestor (store forwarded from TS), or
 * - a nested `dbxAction` inside the subtree (ambiguous which context owns a value source).
 *
 * For legitimate programmatic-value cases (or a demo intentionally showing the
 * TRIGGERED state) suppress with `<!-- eslint-disable-next-line dereekb-dbx-web/require-action-value-source -->`.
 */
export const DBX_WEB_REQUIRE_ACTION_VALUE_SOURCE_RULE: DbxWebRequireActionValueSourceRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: undefined,
    docs: {
      description: 'Require a value source on a triggered dbxAction so it cannot hang in the TRIGGERED state.',
      recommended: true
    },
    messages: {
      missingValueSource: '`dbxAction` has a trigger (`{{trigger}}`) but no value source, so triggering it hangs — the action never reaches VALUE_READY and the handler never runs. Add a value source (`dbxActionValue`, `[dbxActionValue]`, `[dbxActionValueGetter]`, `[dbxActionValueStream]`, or `[dbxActionForm]`), trigger with `triggerWithValue()`, or disable this line if the value is supplied in TypeScript.'
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
          return; // store/value may be forwarded from an external (TS) source
        }

        const { tokens, nestedAction } = collectActionContext(node);

        if (nestedAction) {
          return; // multiple action contexts — ambiguous which owns a value source
        }

        const trigger = DBX_ACTION_TRIGGER_SELECTORS.find((selector) => tokens.has(selector));

        if (!trigger) {
          return; // not trigger-driven (form/auto/programmatic) — out of scope
        }

        const hasValueSource = DBX_ACTION_VALUE_SOURCE_SELECTORS.some((selector) => tokens.has(selector));

        if (!hasValueSource) {
          context.report({
            loc: actionElementLoc(parserServices, node),
            messageId: 'missingValueSource',
            data: { trigger }
          });
        }
      }
    };
  }
};
