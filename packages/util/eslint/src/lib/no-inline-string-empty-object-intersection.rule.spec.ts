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
        'dereekb-util/no-inline-string-empty-object-intersection': 'error'
      }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/no-inline-string-empty-object-intersection');
}

describe('no-inline-string-empty-object-intersection rule', () => {
  describe('valid', () => {
    it('plain string alias is fine', () => {
      const errors = lintCode(`type Foo = string;`);
      expect(errors).toHaveLength(0);
    });

    it('plain literal union is fine', () => {
      const errors = lintCode(`type Foo = 'a' | 'b';`);
      expect(errors).toHaveLength(0);
    });

    it("'a' | 'b' | string is not flagged by THIS rule (handled by prefer-suggested-string)", () => {
      const errors = lintCode(`type Foo = 'a' | 'b' | string;`);
      expect(errors).toHaveLength(0);
    });

    it('string & Record<never, never> (the SuggestedString implementation) is fine', () => {
      const errors = lintCode(`type Foo<T extends string> = T | (string & Record<never, never>);`);
      expect(errors).toHaveLength(0);
    });

    it('string & number is not flagged (not the empty-object form)', () => {
      const errors = lintCode(`type Foo = string & number;`);
      expect(errors).toHaveLength(0);
    });

    it('string & { foo: 1 } is not flagged (not an EMPTY literal)', () => {
      const errors = lintCode(`type Foo = string & { foo: 1 };`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid', () => {
    it('flags `string & {}` standalone', () => {
      const errors = lintCode(`type Foo = string & {};`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('SuggestedString');
    });

    it('flags `{} & string` (reversed order)', () => {
      const errors = lintCode(`type Foo = {} & string;`);
      expect(errors).toHaveLength(1);
    });

    it("flags `'a' | (string & {})`", () => {
      const errors = lintCode(`type Foo = 'a' | (string & {});`);
      expect(errors).toHaveLength(1);
    });

    it("flags `'a' | 'b' | (string & {})`", () => {
      const errors = lintCode(`type Foo = 'a' | 'b' | (string & {});`);
      expect(errors).toHaveLength(1);
    });

    it('flags `string & {}` inside a function parameter', () => {
      const errors = lintCode(`function f(x: 'a' | (string & {})): void { void x; }`);
      expect(errors).toHaveLength(1);
    });
  });
});
