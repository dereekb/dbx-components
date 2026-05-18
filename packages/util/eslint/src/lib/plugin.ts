import { type UtilRequireNoSideEffectsRuleDefinition, UTIL_REQUIRE_NO_SIDE_EFFECTS_RULE } from './require-no-side-effects.rule';
import { type UtilPreferNoSideEffectsInJsdocRuleDefinition, UTIL_PREFER_NO_SIDE_EFFECTS_IN_JSDOC_RULE } from './prefer-no-side-effects-in-jsdoc.rule';
import { type UtilNoSisterReExportRuleDefinition, UTIL_NO_SISTER_RE_EXPORT_RULE } from './no-sister-re-export.rule';
import { type UtilRequireSingleReturnRuleDefinition, UTIL_REQUIRE_SINGLE_RETURN_RULE } from './require-single-return.rule';
import { type UtilRequireReadonlyConfigParamsRuleDefinition, UTIL_REQUIRE_READONLY_CONFIG_PARAMS_RULE } from './require-readonly-config-params.rule';
import { type UtilPreferConfigObjectRuleDefinition, UTIL_PREFER_CONFIG_OBJECT_RULE, UTIL_PREFER_CONFIG_OBJECT_HARD_RULE } from './prefer-config-object.rule';
import { type UtilPreferMaybeTypeRuleDefinition, UTIL_PREFER_MAYBE_TYPE_RULE } from './prefer-maybe-type.rule';
import { type UtilNoInlineTypeImportRuleDefinition, UTIL_NO_INLINE_TYPE_IMPORT_RULE } from './no-inline-type-import.rule';
import { type UtilRequireDeprecatedAliasPlacementRuleDefinition, UTIL_REQUIRE_DEPRECATED_ALIAS_PLACEMENT_RULE } from './require-deprecated-alias-placement.rule';
import { type UtilPreferCanonicalJsdocRuleDefinition, UTIL_PREFER_CANONICAL_JSDOC_RULE } from './prefer-canonical-jsdoc.rule';
import { type UtilRequireDbxUtilCompanionTagsRuleDefinition, UTIL_REQUIRE_DBX_UTIL_COMPANION_TAGS_RULE } from './require-dbx-util-companion-tags.rule';
import { type UtilRequireDbxPipeCompanionTagsRuleDefinition, UTIL_REQUIRE_DBX_PIPE_COMPANION_TAGS_RULE } from './require-dbx-pipe-companion-tags.rule';
import { type UtilRequireDbxFilterCompanionTagsRuleDefinition, UTIL_REQUIRE_DBX_FILTER_COMPANION_TAGS_RULE } from './require-dbx-filter-companion-tags.rule';
import { type UtilRequireDbxWebCompanionTagsRuleDefinition, UTIL_REQUIRE_DBX_WEB_COMPANION_TAGS_RULE } from './require-dbx-web-companion-tags.rule';
import { type UtilRequireDbxDocsUiExampleCompanionTagsRuleDefinition, UTIL_REQUIRE_DBX_DOCS_UI_EXAMPLE_COMPANION_TAGS_RULE } from './require-dbx-docs-ui-example-companion-tags.rule';
import { type UtilRequireDbxModelSnapshotFieldCompanionTagsRuleDefinition, UTIL_REQUIRE_DBX_MODEL_SNAPSHOT_FIELD_COMPANION_TAGS_RULE } from './require-dbx-model-snapshot-field-companion-tags.rule';
import { type UtilRequireDbxModelFirebaseIndexCompanionTagsRuleDefinition, UTIL_REQUIRE_DBX_MODEL_FIREBASE_INDEX_COMPANION_TAGS_RULE } from './require-dbx-model-firebase-index-companion-tags.rule';
import { type UtilRequireDbxActionCompanionTagsRuleDefinition, UTIL_REQUIRE_DBX_ACTION_COMPANION_TAGS_RULE } from './require-dbx-action-companion-tags.rule';
import { type UtilRequireDbxFormFieldCompanionTagsRuleDefinition, UTIL_REQUIRE_DBX_FORM_FIELD_COMPANION_TAGS_RULE } from './require-dbx-form-field-companion-tags.rule';
import { type UtilRequireDbxModelCompanionTagsRuleDefinition, UTIL_REQUIRE_DBX_MODEL_COMPANION_TAGS_RULE } from './require-dbx-model-companion-tags.rule';
import { type UtilRequireDbxAuthCompanionTagsRuleDefinition, UTIL_REQUIRE_DBX_AUTH_COMPANION_TAGS_RULE } from './require-dbx-auth-companion-tags.rule';
import { type UtilRequireDbxRuleCompanionTagsRuleDefinition, UTIL_REQUIRE_DBX_RULE_COMPANION_TAGS_RULE } from './require-dbx-rule-companion-tags.rule';
import { type UtilRequireConstantNamingRuleDefinition, UTIL_REQUIRE_CONSTANT_NAMING_RULE } from './require-constant-naming.rule';
import { type UtilRequireDefaultPrefixNamingRuleDefinition, UTIL_REQUIRE_DEFAULT_PREFIX_NAMING_RULE } from './require-default-prefix-naming.rule';
import { type UtilRequireExportedJsdocExampleRuleDefinition, UTIL_REQUIRE_EXPORTED_JSDOC_EXAMPLE_RULE } from './require-exported-jsdoc-example.rule';
import { type UtilNoInlineStringEmptyObjectIntersectionRuleDefinition, UTIL_NO_INLINE_STRING_EMPTY_OBJECT_INTERSECTION_RULE } from './no-inline-string-empty-object-intersection.rule';
import { type UtilPreferSuggestedStringRuleDefinition, UTIL_PREFER_SUGGESTED_STRING_RULE } from './prefer-suggested-string.rule';

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
    readonly 'require-constant-naming': UtilRequireConstantNamingRuleDefinition;
    readonly 'require-default-prefix-naming': UtilRequireDefaultPrefixNamingRuleDefinition;
    readonly 'require-exported-jsdoc-example': UtilRequireExportedJsdocExampleRuleDefinition;
    readonly 'no-inline-string-empty-object-intersection': UtilNoInlineStringEmptyObjectIntersectionRuleDefinition;
    readonly 'prefer-suggested-string': UtilPreferSuggestedStringRuleDefinition;
  };
}

/**
 * ESLint plugin for @dereekb/util rules.
 *
 * Register as a plugin in your flat ESLint config, then enable individual rules
 * under the chosen plugin prefix (e.g. 'dereekb-util/require-no-side-effects').
 */
export const UTIL_ESLINT_PLUGIN: UtilEslintPlugin = {
  rules: {
    'require-no-side-effects': UTIL_REQUIRE_NO_SIDE_EFFECTS_RULE,
    'prefer-no-side-effects-in-jsdoc': UTIL_PREFER_NO_SIDE_EFFECTS_IN_JSDOC_RULE,
    'no-sister-re-export': UTIL_NO_SISTER_RE_EXPORT_RULE,
    'require-single-return': UTIL_REQUIRE_SINGLE_RETURN_RULE,
    'require-readonly-config-params': UTIL_REQUIRE_READONLY_CONFIG_PARAMS_RULE,
    'prefer-config-object': UTIL_PREFER_CONFIG_OBJECT_RULE,
    'prefer-config-object-hard': UTIL_PREFER_CONFIG_OBJECT_HARD_RULE,
    'prefer-maybe-type': UTIL_PREFER_MAYBE_TYPE_RULE,
    'no-inline-type-import': UTIL_NO_INLINE_TYPE_IMPORT_RULE,
    'require-deprecated-alias-placement': UTIL_REQUIRE_DEPRECATED_ALIAS_PLACEMENT_RULE,
    'prefer-canonical-jsdoc': UTIL_PREFER_CANONICAL_JSDOC_RULE,
    'require-dbx-util-companion-tags': UTIL_REQUIRE_DBX_UTIL_COMPANION_TAGS_RULE,
    'require-dbx-pipe-companion-tags': UTIL_REQUIRE_DBX_PIPE_COMPANION_TAGS_RULE,
    'require-dbx-filter-companion-tags': UTIL_REQUIRE_DBX_FILTER_COMPANION_TAGS_RULE,
    'require-dbx-web-companion-tags': UTIL_REQUIRE_DBX_WEB_COMPANION_TAGS_RULE,
    'require-dbx-docs-ui-example-companion-tags': UTIL_REQUIRE_DBX_DOCS_UI_EXAMPLE_COMPANION_TAGS_RULE,
    'require-dbx-model-snapshot-field-companion-tags': UTIL_REQUIRE_DBX_MODEL_SNAPSHOT_FIELD_COMPANION_TAGS_RULE,
    'require-dbx-model-firebase-index-companion-tags': UTIL_REQUIRE_DBX_MODEL_FIREBASE_INDEX_COMPANION_TAGS_RULE,
    'require-dbx-action-companion-tags': UTIL_REQUIRE_DBX_ACTION_COMPANION_TAGS_RULE,
    'require-dbx-form-field-companion-tags': UTIL_REQUIRE_DBX_FORM_FIELD_COMPANION_TAGS_RULE,
    'require-dbx-model-companion-tags': UTIL_REQUIRE_DBX_MODEL_COMPANION_TAGS_RULE,
    'require-dbx-auth-companion-tags': UTIL_REQUIRE_DBX_AUTH_COMPANION_TAGS_RULE,
    'require-dbx-rule-companion-tags': UTIL_REQUIRE_DBX_RULE_COMPANION_TAGS_RULE,
    'require-constant-naming': UTIL_REQUIRE_CONSTANT_NAMING_RULE,
    'require-default-prefix-naming': UTIL_REQUIRE_DEFAULT_PREFIX_NAMING_RULE,
    'require-exported-jsdoc-example': UTIL_REQUIRE_EXPORTED_JSDOC_EXAMPLE_RULE,
    'no-inline-string-empty-object-intersection': UTIL_NO_INLINE_STRING_EMPTY_OBJECT_INTERSECTION_RULE,
    'prefer-suggested-string': UTIL_PREFER_SUGGESTED_STRING_RULE
  }
};

/**
 * camelCase alias of {@link UTIL_ESLINT_PLUGIN} matching the conventional ESLint plugin export name.
 *
 * @dbxAllowConstantName
 */
export const utilESLintPlugin: UtilEslintPlugin = UTIL_ESLINT_PLUGIN;
