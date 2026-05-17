import { type UtilRequireNoSideEffectsRuleDefinition, utilRequireNoSideEffectsRule } from './require-no-side-effects.rule';
import { type UtilPreferNoSideEffectsInJsdocRuleDefinition, utilPreferNoSideEffectsInJsdocRule } from './prefer-no-side-effects-in-jsdoc.rule';
import { type UtilNoSisterReExportRuleDefinition, utilNoSisterReExportRule } from './no-sister-re-export.rule';
import { type UtilRequireSingleReturnRuleDefinition, utilRequireSingleReturnRule } from './require-single-return.rule';
import { type UtilRequireReadonlyConfigParamsRuleDefinition, utilRequireReadonlyConfigParamsRule } from './require-readonly-config-params.rule';
import { type UtilPreferConfigObjectRuleDefinition, utilPreferConfigObjectRule, utilPreferConfigObjectHardRule } from './prefer-config-object.rule';
import { type UtilPreferMaybeTypeRuleDefinition, utilPreferMaybeTypeRule } from './prefer-maybe-type.rule';
import { type UtilNoInlineTypeImportRuleDefinition, utilNoInlineTypeImportRule } from './no-inline-type-import.rule';
import { type UtilRequireDeprecatedAliasPlacementRuleDefinition, utilRequireDeprecatedAliasPlacementRule } from './require-deprecated-alias-placement.rule';
import { type UtilPreferCanonicalJsdocRuleDefinition, utilPreferCanonicalJsdocRule } from './prefer-canonical-jsdoc.rule';
import { type UtilRequireDbxUtilCompanionTagsRuleDefinition, utilRequireDbxUtilCompanionTagsRule } from './require-dbx-util-companion-tags.rule';
import { type UtilRequireDbxPipeCompanionTagsRuleDefinition, utilRequireDbxPipeCompanionTagsRule } from './require-dbx-pipe-companion-tags.rule';
import { type UtilRequireDbxFilterCompanionTagsRuleDefinition, utilRequireDbxFilterCompanionTagsRule } from './require-dbx-filter-companion-tags.rule';
import { type UtilRequireDbxWebCompanionTagsRuleDefinition, utilRequireDbxWebCompanionTagsRule } from './require-dbx-web-companion-tags.rule';
import { type UtilRequireDbxDocsUiExampleCompanionTagsRuleDefinition, utilRequireDbxDocsUiExampleCompanionTagsRule } from './require-dbx-docs-ui-example-companion-tags.rule';
import { type UtilRequireDbxModelSnapshotFieldCompanionTagsRuleDefinition, utilRequireDbxModelSnapshotFieldCompanionTagsRule } from './require-dbx-model-snapshot-field-companion-tags.rule';
import { type UtilRequireDbxModelFirebaseIndexCompanionTagsRuleDefinition, utilRequireDbxModelFirebaseIndexCompanionTagsRule } from './require-dbx-model-firebase-index-companion-tags.rule';
import { type UtilRequireDbxActionCompanionTagsRuleDefinition, utilRequireDbxActionCompanionTagsRule } from './require-dbx-action-companion-tags.rule';
import { type UtilRequireDbxFormFieldCompanionTagsRuleDefinition, utilRequireDbxFormFieldCompanionTagsRule } from './require-dbx-form-field-companion-tags.rule';
import { type UtilRequireDbxModelCompanionTagsRuleDefinition, utilRequireDbxModelCompanionTagsRule } from './require-dbx-model-companion-tags.rule';
import { type UtilRequireDbxAuthCompanionTagsRuleDefinition, utilRequireDbxAuthCompanionTagsRule } from './require-dbx-auth-companion-tags.rule';
import { type UtilRequireDbxRuleCompanionTagsRuleDefinition, utilRequireDbxRuleCompanionTagsRule } from './require-dbx-rule-companion-tags.rule';

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
    readonly 'prefer-config-object-hard': UtilPreferConfigObjectRuleDefinition;
    readonly 'prefer-maybe-type': UtilPreferMaybeTypeRuleDefinition;
    readonly 'no-inline-type-import': UtilNoInlineTypeImportRuleDefinition;
    readonly 'require-deprecated-alias-placement': UtilRequireDeprecatedAliasPlacementRuleDefinition;
    readonly 'prefer-canonical-jsdoc': UtilPreferCanonicalJsdocRuleDefinition;
    readonly 'require-dbx-util-companion-tags': UtilRequireDbxUtilCompanionTagsRuleDefinition;
    readonly 'require-dbx-pipe-companion-tags': UtilRequireDbxPipeCompanionTagsRuleDefinition;
    readonly 'require-dbx-filter-companion-tags': UtilRequireDbxFilterCompanionTagsRuleDefinition;
    readonly 'require-dbx-web-companion-tags': UtilRequireDbxWebCompanionTagsRuleDefinition;
    readonly 'require-dbx-docs-ui-example-companion-tags': UtilRequireDbxDocsUiExampleCompanionTagsRuleDefinition;
    readonly 'require-dbx-model-snapshot-field-companion-tags': UtilRequireDbxModelSnapshotFieldCompanionTagsRuleDefinition;
    readonly 'require-dbx-model-firebase-index-companion-tags': UtilRequireDbxModelFirebaseIndexCompanionTagsRuleDefinition;
    readonly 'require-dbx-action-companion-tags': UtilRequireDbxActionCompanionTagsRuleDefinition;
    readonly 'require-dbx-form-field-companion-tags': UtilRequireDbxFormFieldCompanionTagsRuleDefinition;
    readonly 'require-dbx-model-companion-tags': UtilRequireDbxModelCompanionTagsRuleDefinition;
    readonly 'require-dbx-auth-companion-tags': UtilRequireDbxAuthCompanionTagsRuleDefinition;
    readonly 'require-dbx-rule-companion-tags': UtilRequireDbxRuleCompanionTagsRuleDefinition;
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
    'prefer-config-object-hard': utilPreferConfigObjectHardRule,
    'prefer-maybe-type': utilPreferMaybeTypeRule,
    'no-inline-type-import': utilNoInlineTypeImportRule,
    'require-deprecated-alias-placement': utilRequireDeprecatedAliasPlacementRule,
    'prefer-canonical-jsdoc': utilPreferCanonicalJsdocRule,
    'require-dbx-util-companion-tags': utilRequireDbxUtilCompanionTagsRule,
    'require-dbx-pipe-companion-tags': utilRequireDbxPipeCompanionTagsRule,
    'require-dbx-filter-companion-tags': utilRequireDbxFilterCompanionTagsRule,
    'require-dbx-web-companion-tags': utilRequireDbxWebCompanionTagsRule,
    'require-dbx-docs-ui-example-companion-tags': utilRequireDbxDocsUiExampleCompanionTagsRule,
    'require-dbx-model-snapshot-field-companion-tags': utilRequireDbxModelSnapshotFieldCompanionTagsRule,
    'require-dbx-model-firebase-index-companion-tags': utilRequireDbxModelFirebaseIndexCompanionTagsRule,
    'require-dbx-action-companion-tags': utilRequireDbxActionCompanionTagsRule,
    'require-dbx-form-field-companion-tags': utilRequireDbxFormFieldCompanionTagsRule,
    'require-dbx-model-companion-tags': utilRequireDbxModelCompanionTagsRule,
    'require-dbx-auth-companion-tags': utilRequireDbxAuthCompanionTagsRule,
    'require-dbx-rule-companion-tags': utilRequireDbxRuleCompanionTagsRule
  }
};
