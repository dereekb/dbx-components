import { FIREBASE_REQUIRE_TAGGED_FIRESTORE_CONSTRAINTS_RULE } from './require-tagged-firestore-constraints.rule';
import { FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_QUERY_SUFFIX_RULE } from './require-dbx-model-firebase-index-query-suffix.rule';
import { FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_COMPANION_TAGS_RULE } from './require-dbx-model-firebase-index-companion-tags.rule';
import { FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_DISPATCHER_USES_TAGGED_QUERIES_RULE } from './require-dbx-model-firebase-index-dispatcher-uses-tagged-queries.rule';

/**
 * ESLint plugin interface for `@dereekb/firebase` rules.
 */
export interface FirebaseEslintPlugin {
  readonly rules: {
    readonly 'require-tagged-firestore-constraints': typeof FIREBASE_REQUIRE_TAGGED_FIRESTORE_CONSTRAINTS_RULE;
    readonly 'require-dbx-model-firebase-index-query-suffix': typeof FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_QUERY_SUFFIX_RULE;
    readonly 'require-dbx-model-firebase-index-companion-tags': typeof FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_COMPANION_TAGS_RULE;
    readonly 'require-dbx-model-firebase-index-dispatcher-uses-tagged-queries': typeof FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_DISPATCHER_USES_TAGGED_QUERIES_RULE;
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
    'require-dbx-model-firebase-index-dispatcher-uses-tagged-queries': FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_DISPATCHER_USES_TAGGED_QUERIES_RULE
  }
};

/**
 * camelCase alias of {@link FIREBASE_ESLINT_PLUGIN} matching the conventional ESLint plugin export name.
 *
 * @dbxAllowConstantName
 */
export const firebaseESLintPlugin: FirebaseEslintPlugin = FIREBASE_ESLINT_PLUGIN;
