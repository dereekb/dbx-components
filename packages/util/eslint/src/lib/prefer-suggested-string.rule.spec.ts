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
        'dereekb-util/prefer-suggested-string': 'warn'
      }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/prefer-suggested-string');
}

describe('prefer-suggested-string rule', () => {
  describe('valid', () => {
    it('plain string is fine', () => {
      const errors = lintCode(`type Foo = string;`);
      expect(errors).toHaveLength(0);
    });

    it('plain literal union is fine', () => {
      const errors = lintCode(`type Foo = 'a' | 'b';`);
      expect(errors).toHaveLength(0);
    });

    it('string | number (no string literal) is fine', () => {
      const errors = lintCode(`type Foo = string | number;`);
      expect(errors).toHaveLength(0);
    });

    it('SuggestedString<...> (the canonical form) is fine', () => {
      const errors = lintCode(`
type SuggestedString<T extends string> = T | (string & Record<never, never>);
type Foo = SuggestedString<'a' | 'b'>;
`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid', () => {
    it("flags `'a' | string`", () => {
      const errors = lintCode(`type Foo = 'a' | string;`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('SuggestedString');
    });

    it("flags `'a' | 'b' | string`", () => {
      const errors = lintCode(`type Foo = 'a' | 'b' | string;`);
      expect(errors).toHaveLength(1);
    });

    it("flags `string | 'a'` (reversed order)", () => {
      const errors = lintCode(`type Foo = string | 'a';`);
      expect(errors).toHaveLength(1);
    });

    it("flags `'a' | string` in a parameter type", () => {
      const errors = lintCode(`function f(x: 'a' | string): void { void x; }`);
      expect(errors).toHaveLength(1);
    });

    it("flags `('a' | 'b') | string` (parenthesized literal union member)", () => {
      const errors = lintCode(`type Foo = ('a' | 'b') | string;`);
      // The parser flattens this into a single union, so the rule still sees both halves.
      expect(errors).toHaveLength(1);
    });
  });
});
