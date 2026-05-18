import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { UTIL_ESLINT_PLUGIN } from './plugin';

function buildConfig(): Linter.Config[] {
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
        'dereekb-util/no-inline-type-import': 'error'
      }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/no-inline-type-import');
}

describe('no-inline-type-import rule', () => {
  describe('valid', () => {
    it('top-of-file import type is fine', () => {
      const errors = lintCode(`
import type { Foo } from './foo';
const x: Foo = null as any;
`);
      expect(errors).toHaveLength(0);
    });

    it('top-of-file value import is fine', () => {
      const errors = lintCode(`
import { Foo } from './foo';
const x: Foo = null as any;
`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid', () => {
    it('flags inline import(...).Type in a type annotation', () => {
      const errors = lintCode(`
const x: import('./foo').Foo = null as any;
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("import('./foo').Foo");
    });

    it('flags inline import(...) in a type alias', () => {
      const errors = lintCode(`
type Foo = import('./foo').Foo;
`);
      expect(errors).toHaveLength(1);
    });

    it('flags inline import(...) in a function return type', () => {
      const errors = lintCode(`
function get(): import('./foo').Foo {
  return null as any;
}
`);
      expect(errors).toHaveLength(1);
    });

    it('flags inline import(...) in a parameter type', () => {
      const errors = lintCode(`
function take(x: import('./foo').Foo): void {
  void x;
}
`);
      expect(errors).toHaveLength(1);
    });

    it('flags nested qualifier (import(...).Outer.Inner)', () => {
      const errors = lintCode(`
type Foo = import('./foo').Outer.Inner;
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Inner');
    });
  });
});
