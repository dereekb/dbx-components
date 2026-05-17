import { type UtilRequireNoSideEffectsRuleDefinition, utilRequireNoSideEffectsRule } from './require-no-side-effects.rule';
import { type UtilPreferNoSideEffectsInJsdocRuleDefinition, utilPreferNoSideEffectsInJsdocRule } from './prefer-no-side-effects-in-jsdoc.rule';
import { type UtilNoSisterReExportRuleDefinition, utilNoSisterReExportRule } from './no-sister-re-export.rule';
import { type UtilRequireSingleReturnRuleDefinition, utilRequireSingleReturnRule } from './require-single-return.rule';
import { type UtilRequireReadonlyConfigParamsRuleDefinition, utilRequireReadonlyConfigParamsRule } from './require-readonly-config-params.rule';
import { type UtilPreferConfigObjectRuleDefinition, utilPreferConfigObjectRule } from './prefer-config-object.rule';
import { type UtilPreferMaybeTypeRuleDefinition, utilPreferMaybeTypeRule } from './prefer-maybe-type.rule';
import { type UtilNoInlineTypeImportRuleDefinition, utilNoInlineTypeImportRule } from './no-inline-type-import.rule';
import { type UtilRequireDeprecatedAliasPlacementRuleDefinition, utilRequireDeprecatedAliasPlacementRule } from './require-deprecated-alias-placement.rule';

/**
 * ESLint plugin interface for @dereekb/util rules.
 */
export interface UtilEslintPlugin {
  readonly rules: {
    readonly 'require-no-side-effects': UtilRequireNoSideEffectsRuleDefinition;
    readonly 'prefer-no-side-effects-in-jsdoc': UtilPreferNoSideEffectsInJsdocRuleDefinition;
    readonly 'no-sister-re-export': UtilNoSisterReExportRuleDefinition;
    readonly 'require-single-return': UtilRequireSingleReturnRuleDefinition;
    readonly 'require-readonly-config-params': UtilRequireReadonlyConfigParamsRuleDefinition;
    readonly 'prefer-config-object': UtilPreferConfigObjectRuleDefinition;
    readonly 'prefer-maybe-type': UtilPreferMaybeTypeRuleDefinition;
    readonly 'no-inline-type-import': UtilNoInlineTypeImportRuleDefinition;
    readonly 'require-deprecated-alias-placement': UtilRequireDeprecatedAliasPlacementRuleDefinition;
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
    'prefer-no-side-effects-in-jsdoc': utilPreferNoSideEffectsInJsdocRule,
    'no-sister-re-export': utilNoSisterReExportRule,
    'require-single-return': utilRequireSingleReturnRule,
    'require-readonly-config-params': utilRequireReadonlyConfigParamsRule,
    'prefer-config-object': utilPreferConfigObjectRule,
    'prefer-maybe-type': utilPreferMaybeTypeRule,
    'no-inline-type-import': utilNoInlineTypeImportRule,
    'require-deprecated-alias-placement': utilRequireDeprecatedAliasPlacementRule
  }
};
