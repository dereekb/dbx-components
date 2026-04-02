import { type NestjsRequireInjectRuleDefinition, nestjsRequireInjectRule } from './require-inject.rule';

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
export const nestjsEslintPlugin: NestjsEslintPlugin = {
  rules: {
    'require-nest-inject': nestjsRequireInjectRule
  }
};
