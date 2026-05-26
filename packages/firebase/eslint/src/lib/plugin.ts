import { FIREBASE_REQUIRE_TAGGED_FIRESTORE_CONSTRAINTS_RULE } from './require-tagged-firestore-constraints.rule';
import { FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_QUERY_SUFFIX_RULE } from './require-dbx-model-firebase-index-query-suffix.rule';
import { FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_COMPANION_TAGS_RULE } from './require-dbx-model-firebase-index-companion-tags.rule';
import { FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_VALID_DISPATCHER_RULE } from './require-dbx-model-firebase-index-valid-dispatcher.rule';
import { FIREBASE_REQUIRE_FIRESTORE_CONSTRAINT_TYPE_PARAMETER_RULE } from './require-firestore-constraint-type-parameter.rule';
import { FIREBASE_REQUIRE_COMPLETE_CRUD_FUNCTION_CONFIG_MAP_RULE } from './require-complete-crud-function-config-map.rule';
import { FIREBASE_REQUIRE_API_DETAILS_FOR_CRUD_FUNCTION_RULE } from './require-api-details-for-crud-function.rule';
import { FIREBASE_REQUIRE_STORAGEFILE_POLICY_MATCHES_RULES_RULE } from './require-storagefile-policy-matches-rules.rule';
import { FIREBASE_REQUIRE_FIRESTORE_RULE_FOR_SERVICE_MODEL_RULE } from './require-firestore-rule-for-service-model.rule';
import { FIREBASE_REQUIRE_DBX_MODEL_SERVICE_FACTORY_TAG_RULE } from './require-dbx-model-service-factory-tag.rule';
import { FIREBASE_REQUIRE_SERVICE_FACTORY_FOR_DBX_MODEL_RULE } from './require-service-factory-for-dbx-model.rule';
import { FIREBASE_REQUIRE_DBX_MODEL_COMPANION_TAGS_RULE } from './require-dbx-model-companion-tags.rule';

/**
 * ESLint plugin interface for `@dereekb/firebase` rules.
 */
export interface FirebaseEslintPlugin {
  readonly rules: {
    readonly 'require-tagged-firestore-constraints': typeof FIREBASE_REQUIRE_TAGGED_FIRESTORE_CONSTRAINTS_RULE;
    readonly 'require-dbx-model-firebase-index-query-suffix': typeof FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_QUERY_SUFFIX_RULE;
    readonly 'require-dbx-model-firebase-index-companion-tags': typeof FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_COMPANION_TAGS_RULE;
    readonly 'require-dbx-model-firebase-index-valid-dispatcher': typeof FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_VALID_DISPATCHER_RULE;
    readonly 'require-firestore-constraint-type-parameter': typeof FIREBASE_REQUIRE_FIRESTORE_CONSTRAINT_TYPE_PARAMETER_RULE;
    readonly 'require-complete-crud-function-config-map': typeof FIREBASE_REQUIRE_COMPLETE_CRUD_FUNCTION_CONFIG_MAP_RULE;
    readonly 'require-api-details-for-crud-function': typeof FIREBASE_REQUIRE_API_DETAILS_FOR_CRUD_FUNCTION_RULE;
    readonly 'require-storagefile-policy-matches-rules': typeof FIREBASE_REQUIRE_STORAGEFILE_POLICY_MATCHES_RULES_RULE;
    readonly 'require-firestore-rule-for-service-model': typeof FIREBASE_REQUIRE_FIRESTORE_RULE_FOR_SERVICE_MODEL_RULE;
    readonly 'require-dbx-model-service-factory-tag': typeof FIREBASE_REQUIRE_DBX_MODEL_SERVICE_FACTORY_TAG_RULE;
    readonly 'require-service-factory-for-dbx-model': typeof FIREBASE_REQUIRE_SERVICE_FACTORY_FOR_DBX_MODEL_RULE;
    readonly 'require-dbx-model-companion-tags': typeof FIREBASE_REQUIRE_DBX_MODEL_COMPANION_TAGS_RULE;
  };
}

/**
 * ESLint plugin for `@dereekb/firebase` rules.
 *
 * Register as a plugin in your flat ESLint config, then enable individual rules
 * under the chosen plugin prefix (e.g. 'dereekb-firebase/require-tagged-firestore-constraints').
 */
export const FIREBASE_ESLINT_PLUGIN: FirebaseEslintPlugin = {
  rules: {
    'require-tagged-firestore-constraints': FIREBASE_REQUIRE_TAGGED_FIRESTORE_CONSTRAINTS_RULE,
    'require-dbx-model-firebase-index-query-suffix': FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_QUERY_SUFFIX_RULE,
    'require-dbx-model-firebase-index-companion-tags': FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_COMPANION_TAGS_RULE,
    'require-dbx-model-firebase-index-valid-dispatcher': FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_VALID_DISPATCHER_RULE,
    'require-firestore-constraint-type-parameter': FIREBASE_REQUIRE_FIRESTORE_CONSTRAINT_TYPE_PARAMETER_RULE,
    'require-complete-crud-function-config-map': FIREBASE_REQUIRE_COMPLETE_CRUD_FUNCTION_CONFIG_MAP_RULE,
    'require-api-details-for-crud-function': FIREBASE_REQUIRE_API_DETAILS_FOR_CRUD_FUNCTION_RULE,
    'require-storagefile-policy-matches-rules': FIREBASE_REQUIRE_STORAGEFILE_POLICY_MATCHES_RULES_RULE,
    'require-firestore-rule-for-service-model': FIREBASE_REQUIRE_FIRESTORE_RULE_FOR_SERVICE_MODEL_RULE,
    'require-dbx-model-service-factory-tag': FIREBASE_REQUIRE_DBX_MODEL_SERVICE_FACTORY_TAG_RULE,
    'require-service-factory-for-dbx-model': FIREBASE_REQUIRE_SERVICE_FACTORY_FOR_DBX_MODEL_RULE,
    'require-dbx-model-companion-tags': FIREBASE_REQUIRE_DBX_MODEL_COMPANION_TAGS_RULE
  }
};

/**
 * camelCase alias of {@link FIREBASE_ESLINT_PLUGIN} matching the conventional ESLint plugin export name.
 *
 * @dbxAllowConstantName
 */
export const firebaseESLintPlugin: FirebaseEslintPlugin = FIREBASE_ESLINT_PLUGIN;
