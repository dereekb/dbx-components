import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { UTIL_ESLINT_PLUGIN } from './plugin';

const RULE_ID = 'dereekb-util/require-default-prefix-naming';

function makeConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: 'module'
        }
      },
      plugins: {
        'dereekb-util': UTIL_ESLINT_PLUGIN as any
      },
      rules: {
        [RULE_ID]: 'error'
      }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, makeConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

describe('require-default-prefix-naming rule', () => {
  describe('flagged names', () => {
    it('SCREAMING_CASE with mid-name _DEFAULT_ is flagged', () => {
      const errors = lintCode(`export const DBX_WEB_FILE_PREVIEW_SERVICE_DEFAULT_PREVIEW_COMPONENT_FUNCTION = () => null;`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('defaultShouldBePrefix');
      expect(errors[0].message).toContain('DEFAULT_DBX_WEB_FILE_PREVIEW_SERVICE_PREVIEW_COMPONENT_FUNCTION');
    });

    it('SCREAMING_CASE with trailing _DEFAULT is flagged', () => {
      const errors = lintCode(`export const FOO_BAR_DEFAULT = 1;`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('DEFAULT_FOO_BAR');
    });

    it('non-exported SCREAMING_CASE const is flagged', () => {
      const errors = lintCode(`const FOO_DEFAULT_BAR = 1;`);
      expect(errors).toHaveLength(1);
    });

    it('multiple misplaced DEFAULT segments are coalesced into a single prefix', () => {
      const errors = lintCode(`export const FOO_DEFAULT_BAR_DEFAULT_BAZ = 1;`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('DEFAULT_FOO_BAR_BAZ');
    });
  });

  describe('passing names', () => {
    it('already-prefixed DEFAULT_ name passes', () => {
      const errors = lintCode(`export const DEFAULT_DBX_WEB_FILE_PREVIEW_SERVICE_PREVIEW_COMPONENT_FUNCTION = () => null;`);
      expect(errors).toHaveLength(0);
    });

    it('SCREAMING_CASE name without DEFAULT segment passes', () => {
      const errors = lintCode(`export const COMMA_JOINER = ',';`);
      expect(errors).toHaveLength(0);
    });

    it('name containing DEFAULT only as a substring of a longer word passes', () => {
      const errors = lintCode(`export const FOO_DEFAULTING_BAR = 1;`);
      expect(errors).toHaveLength(0);
    });

    it('camelCase binding is ignored', () => {
      const errors = lintCode(`export const fooDefaultBar = 1;`);
      expect(errors).toHaveLength(0);
    });

    it('PascalCase binding is ignored', () => {
      const errors = lintCode(`export const FooDefaultBar = 1;`);
      expect(errors).toHaveLength(0);
    });

    it('underscore-prefixed binding is ignored', () => {
      const errors = lintCode(`export const _FOO_DEFAULT_BAR = 1;`);
      expect(errors).toHaveLength(0);
    });

    it('let declaration is ignored', () => {
      const errors = lintCode(`export let FOO_DEFAULT_BAR = 1;`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('exemptions', () => {
    it('@dbxAllowDefaultPrefix JSDoc skips the rule', () => {
      const errors = lintCode(`
        /**
         * @dbxAllowDefaultPrefix
         */
        export const FOO_DEFAULT_BAR = 1;
      `);
      expect(errors).toHaveLength(0);
    });

    it('@dbxAllowDefaultPrefix JSDoc on a non-exported declaration skips the rule', () => {
      const errors = lintCode(`
        /**
         * @dbxAllowDefaultPrefix
         */
        const FOO_DEFAULT_BAR = 1;
      `);
      expect(errors).toHaveLength(0);
    });
  });
});
