import { type DbxCliValidDbxRouteModelTagsRuleDefinition, DBX_CLI_VALID_DBX_ROUTE_MODEL_TAGS_RULE } from './valid-dbx-route-model-tags.rule';

/**
 * ESLint plugin interface for `@dereekb/dbx-cli` rules.
 */
export interface DbxCliEslintPlugin {
  readonly rules: {
    readonly 'valid-dbx-route-model-tags': DbxCliValidDbxRouteModelTagsRuleDefinition;
  };
}

/**
 * ESLint plugin for `@dereekb/dbx-cli` rules.
 *
 * Register as a plugin in your flat ESLint config, then enable individual rules
 * under the chosen plugin prefix (e.g. 'dereekb-dbx-cli/valid-dbx-route-model-tags').
 */
export const DBX_CLI_ESLINT_PLUGIN: DbxCliEslintPlugin = {
  rules: {
    'valid-dbx-route-model-tags': DBX_CLI_VALID_DBX_ROUTE_MODEL_TAGS_RULE
  }
};

/**
 * camelCase alias of {@link DBX_CLI_ESLINT_PLUGIN} matching the conventional ESLint plugin export name.
 *
 * @dbxAllowConstantName
 */
export const dbxCliESLintPlugin: DbxCliEslintPlugin = DBX_CLI_ESLINT_PLUGIN;
