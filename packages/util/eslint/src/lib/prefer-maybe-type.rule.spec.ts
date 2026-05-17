import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { utilEslintPlugin } from './plugin';

interface LintOptions {
  readonly allowedTypeNames?: readonly string[];
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
        'dereekb-util/prefer-maybe-type': ruleOptions as any
      }
    }
  ];
}

function lintCode(code: string, options?: LintOptions): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(options), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/prefer-maybe-type');
}

describe('prefer-maybe-type rule', () => {
  describe('valid', () => {
    it('plain type alias is not flagged', () => {
      const errors = lintCode(`type Foo = string;`);
      expect(errors).toHaveLength(0);
    });

    it('union without null/undefined is not flagged', () => {
      const errors = lintCode(`type Foo = string | number;`);
      expect(errors).toHaveLength(0);
    });

    it('optional property is not flagged (uses ? not explicit | undefined)', () => {
      const errors = lintCode(`
interface Foo {
  bar?: string;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('Maybe<T>-style usage is not flagged', () => {
      const errors = lintCode(`
import type { Maybe } from '@dereekb/util';
type Foo = Maybe<string>;
`);
      expect(errors).toHaveLength(0);
    });

    it('allowedTypeNames silences a specific named alias', () => {
      const errors = lintCode(
        `
type Foo = NullableThing | null;
`,
        { allowedTypeNames: ['NullableThing'] }
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid', () => {
    it('flags T | null', () => {
      const errors = lintCode(`type Foo = string | null;`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Maybe<T>');
    });

    it('flags T | undefined in a return type', () => {
      const errors = lintCode(`
function find(id: string): Item | undefined {
  return undefined as any;
}
interface Item {
  readonly id: string;
}
`);
      expect(errors).toHaveLength(1);
    });

    it('flags T | null | undefined', () => {
      const errors = lintCode(`type Foo = string | null | undefined;`);
      expect(errors).toHaveLength(1);
    });

    it('flags explicit | null in interface property', () => {
      const errors = lintCode(`
interface SearchResult {
  readonly match: Item | null;
}
interface Item {
  readonly id: string;
}
`);
      expect(errors).toHaveLength(1);
    });

    it('flags explicit | undefined when ? would have sufficed', () => {
      const errors = lintCode(`
interface SearchResult {
  match: Item | undefined;
}
interface Item {
  readonly id: string;
}
`);
      expect(errors).toHaveLength(1);
    });

    it('still flags when allowedTypeNames is set but no match is on the allowlist', () => {
      const errors = lintCode(
        `
type Foo = string | null;
`,
        { allowedTypeNames: ['SomethingElse'] }
      );
      expect(errors).toHaveLength(1);
    });
  });
});
