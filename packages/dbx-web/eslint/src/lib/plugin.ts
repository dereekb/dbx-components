import { dbxWebRequireCleanSubscriptionRule } from './require-clean-subscription.rule';
import { dbxWebRequireCompleteOnDestroyRule } from './require-complete-on-destroy.rule';
import { dbxWebNoRedundantOnDestroyRule } from './no-redundant-on-destroy.rule';

/**
 * ESLint plugin interface for dbx-web rules.
 */
export interface DbxWebEslintPlugin {
  readonly rules: {
    readonly 'require-clean-subscription': typeof dbxWebRequireCleanSubscriptionRule;
    readonly 'require-complete-on-destroy': typeof dbxWebRequireCompleteOnDestroyRule;
    readonly 'no-redundant-on-destroy': typeof dbxWebNoRedundantOnDestroyRule;
  };
}

/**
 * ESLint plugin for dbx-web rules.
 *
 * Register as a plugin in your flat ESLint config, then enable individual rules
 * under the chosen plugin prefix (e.g. 'dereekb-dbx-web/require-clean-subscription').
 */
export const dbxWebEslintPlugin: DbxWebEslintPlugin = {
  rules: {
    'require-clean-subscription': dbxWebRequireCleanSubscriptionRule,
    'require-complete-on-destroy': dbxWebRequireCompleteOnDestroyRule,
    'no-redundant-on-destroy': dbxWebNoRedundantOnDestroyRule
  }
};
