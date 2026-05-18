import { DBX_WEB_REQUIRE_CLEAN_SUBSCRIPTION_RULE } from './require-clean-subscription.rule';
import { DBX_WEB_REQUIRE_COMPLETE_ON_DESTROY_RULE } from './require-complete-on-destroy.rule';
import { DBX_WEB_NO_REDUNDANT_ON_DESTROY_RULE } from './no-redundant-on-destroy.rule';
import { DBX_WEB_REQUIRE_COMPUTED_SIGNAL_SUFFIX_RULE } from './require-computed-signal-suffix.rule';
import { DBX_WEB_REQUIRE_COMPONENT_CONFIG_INPUT_RULE } from './require-component-config-input.rule';
import { DBX_WEB_REQUIRE_TOP_LEVEL_COMPUTED_SIGNALS_RULE } from './require-top-level-computed-signals.rule';

/**
 * ESLint plugin interface for dbx-web rules.
 */
export interface DbxWebEslintPlugin {
  readonly rules: {
    readonly 'require-clean-subscription': typeof DBX_WEB_REQUIRE_CLEAN_SUBSCRIPTION_RULE;
    readonly 'require-complete-on-destroy': typeof DBX_WEB_REQUIRE_COMPLETE_ON_DESTROY_RULE;
    readonly 'no-redundant-on-destroy': typeof DBX_WEB_NO_REDUNDANT_ON_DESTROY_RULE;
    readonly 'require-computed-signal-suffix': typeof DBX_WEB_REQUIRE_COMPUTED_SIGNAL_SUFFIX_RULE;
    readonly 'require-component-config-input': typeof DBX_WEB_REQUIRE_COMPONENT_CONFIG_INPUT_RULE;
    readonly 'require-top-level-computed-signals': typeof DBX_WEB_REQUIRE_TOP_LEVEL_COMPUTED_SIGNALS_RULE;
  };
}

/**
 * ESLint plugin for dbx-web rules.
 *
 * Register as a plugin in your flat ESLint config, then enable individual rules
 * under the chosen plugin prefix (e.g. 'dereekb-dbx-web/require-clean-subscription').
 */
export const DBX_WEB_ESLINT_PLUGIN: DbxWebEslintPlugin = {
  rules: {
    'require-clean-subscription': DBX_WEB_REQUIRE_CLEAN_SUBSCRIPTION_RULE,
    'require-complete-on-destroy': DBX_WEB_REQUIRE_COMPLETE_ON_DESTROY_RULE,
    'no-redundant-on-destroy': DBX_WEB_NO_REDUNDANT_ON_DESTROY_RULE,
    'require-computed-signal-suffix': DBX_WEB_REQUIRE_COMPUTED_SIGNAL_SUFFIX_RULE,
    'require-component-config-input': DBX_WEB_REQUIRE_COMPONENT_CONFIG_INPUT_RULE,
    'require-top-level-computed-signals': DBX_WEB_REQUIRE_TOP_LEVEL_COMPUTED_SIGNALS_RULE
  }
};
