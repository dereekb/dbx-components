import { type UtilRequireNoSideEffectsRuleDefinition, utilRequireNoSideEffectsRule } from './require-no-side-effects.rule';
import { type UtilPreferNoSideEffectsInJsdocRuleDefinition, utilPreferNoSideEffectsInJsdocRule } from './prefer-no-side-effects-in-jsdoc.rule';

/**
 * ESLint plugin interface for @dereekb/util rules.
 */
export interface UtilEslintPlugin {
  readonly rules: {
    readonly 'require-no-side-effects': UtilRequireNoSideEffectsRuleDefinition;
    readonly 'prefer-no-side-effects-in-jsdoc': UtilPreferNoSideEffectsInJsdocRuleDefinition;
  };
}

/**
 * ESLint plugin for @dereekb/util rules.
 *
 * Register as a plugin in your flat ESLint config, then enable individual rules
 * under the chosen plugin prefix (e.g. 'dereekb-util/require-no-side-effects').
 */
export const utilEslintPlugin: UtilEslintPlugin = {
  rules: {
    'require-no-side-effects': utilRequireNoSideEffectsRule,
    'prefer-no-side-effects-in-jsdoc': utilPreferNoSideEffectsInJsdocRule
  }
};
