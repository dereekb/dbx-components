import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { utilEslintPlugin } from './plugin';

interface LintOptions {
  readonly patterns?: readonly string[];
  readonly allow?: readonly string[];
  readonly allowTypeOnly?: boolean;
}

function buildConfig(options?: LintOptions): Linter.Config[] {
  const ruleOptions = options ? ['error', options] : ['error'];

  return [
    {
      files: ['**/*.ts'],
      languageOptions: {
        parser: tsParser as any,
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: 'module'
        }
      },
      plugins: {
        'dereekb-util': utilEslintPlugin as any
      },
      rules: {
        'dereekb-util/no-sister-re-export': ruleOptions as any
      }
    }
  ];
}

function lintCode(code: string, options?: LintOptions): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(options), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/no-sister-re-export');
}

describe('no-sister-re-export rule', () => {
  describe('valid', () => {
    it('allows relative re-exports', () => {
      const errors = lintCode(`export { foo } from './local';`, { patterns: ['@dereekb/*'] });
      expect(errors).toHaveLength(0);
    });

    it('allows parent-relative re-exports', () => {
      const errors = lintCode(`export { foo } from '../sibling';`, { patterns: ['@dereekb/*'] });
      expect(errors).toHaveLength(0);
    });

    it('allows re-exports from packages that do not match any pattern', () => {
      const errors = lintCode(`export { foo } from 'lodash';`, { patterns: ['@dereekb/*'] });
      expect(errors).toHaveLength(0);
    });

    it('allows pure local re-exports (no source)', () => {
      const errors = lintCode(`const foo = 1; export { foo };`, { patterns: ['@dereekb/*'] });
      expect(errors).toHaveLength(0);
    });

    it('allows specifiers listed in allow', () => {
      const errors = lintCode(`export { foo } from '@dereekb/util/eslint';`, {
        patterns: ['@dereekb/*'],
        allow: ['@dereekb/util/eslint']
      });
      expect(errors).toHaveLength(0);
    });

    it('allows type-only named re-export when allowTypeOnly is true', () => {
      const errors = lintCode(`export type { Foo } from '@dereekb/util';`, {
        patterns: ['@dereekb/*'],
        allowTypeOnly: true
      });
      expect(errors).toHaveLength(0);
    });

    it('allows type-only star re-export when allowTypeOnly is true', () => {
      const errors = lintCode(`export type * from '@dereekb/util';`, {
        patterns: ['@dereekb/*'],
        allowTypeOnly: true
      });
      expect(errors).toHaveLength(0);
    });

    it('is a no-op when patterns is empty', () => {
      const errors = lintCode(`export { foo } from '@dereekb/util'; export * from 'joinfoodflip-usda';`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid', () => {
    it('flags a named re-export from a sister package', () => {
      const errors = lintCode(`export { foo } from '@dereekb/util';`, { patterns: ['@dereekb/*'] });
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('noSisterReExport');
      expect(errors[0].message).toContain('@dereekb/util');
    });

    it('flags a multi-specifier re-export once (reports on the source)', () => {
      const errors = lintCode(`export { foo, bar as baz } from 'joinfoodflip-usda';`, { patterns: ['joinfoodflip-*'] });
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('noSisterReExport');
      expect(errors[0].message).toContain('joinfoodflip-usda');
    });

    it('flags export * from a sister package', () => {
      const errors = lintCode(`export * from '@dereekb/util';`, { patterns: ['@dereekb/*'] });
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('noSisterReExportAll');
    });

    it('flags export * as ns from a sister package', () => {
      const errors = lintCode(`export * as Util from '@dereekb/util';`, { patterns: ['@dereekb/*'] });
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('noSisterReExportAll');
    });

    it('flags type-only re-exports by default (allowTypeOnly defaults to false)', () => {
      const errors = lintCode(`export type { Foo } from '@dereekb/util';`, { patterns: ['@dereekb/*'] });
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('noSisterReExport');
    });

    it('matches nested specifiers under a scope', () => {
      const errors = lintCode(`export { foo } from '@dereekb/util/eslint';`, { patterns: ['@dereekb/*'] });
      expect(errors).toHaveLength(1);
    });

    it('matches mixed named + type specifiers as a non-type-only declaration even with allowTypeOnly', () => {
      const errors = lintCode(`export { foo, type Bar } from '@dereekb/util';`, {
        patterns: ['@dereekb/*'],
        allowTypeOnly: true
      });
      expect(errors).toHaveLength(1);
    });
  });
});
