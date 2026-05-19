import { type NestjsRequireInjectRuleDefinition, NESTJS_REQUIRE_INJECT_RULE } from './require-inject.rule';

/**
 * ESLint plugin interface for NestJS rules.
 */
export interface NestjsEslintPlugin {
  readonly rules: {
    readonly 'require-nest-inject': NestjsRequireInjectRuleDefinition;
  };
}

/**
 * ESLint plugin for NestJS rules.
 *
 * Register as a plugin in your flat ESLint config, then enable individual rules
 * under the chosen plugin prefix (e.g. 'dereekb-nestjs/require-nest-inject').
 */
export const NESTJS_ESLINT_PLUGIN: NestjsEslintPlugin = {
  rules: {
    'require-nest-inject': NESTJS_REQUIRE_INJECT_RULE
  }
};

/**
 * camelCase alias of {@link NESTJS_ESLINT_PLUGIN} matching the conventional ESLint plugin export name.
 *
 * @dbxAllowConstantName
 */
export const nestjsESLintPlugin: NestjsEslintPlugin = NESTJS_ESLINT_PLUGIN;
