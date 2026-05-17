import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { utilEslintPlugin } from './plugin';

interface LintOptions {
  readonly allowedTypeNames?: readonly string[];
  readonly noAutoImport?: boolean;
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

function fixCode(code: string, options?: LintOptions): string {
  const linter = new Linter({ configType: 'flat' });
  const result = linter.verifyAndFix(code, buildConfig(options), { filename: 'test.ts' });
  return result.output;
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

    it('T | undefined alone is not flagged (only null-bearing unions are targeted)', () => {
      const errors = lintCode(`type Foo = string | undefined;`);
      expect(errors).toHaveLength(0);
    });

    it('explicit | undefined in interface property is not flagged', () => {
      const errors = lintCode(`
interface SearchResult {
  match: Item | undefined;
}
interface Item {
  readonly id: string;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('function return type T | undefined is not flagged', () => {
      const errors = lintCode(`
function find(id: string): Item | undefined {
  return undefined as any;
}
interface Item {
  readonly id: string;
}
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

    it('flags optional + | null combination (foo?: T | null)', () => {
      const errors = lintCode(`
interface SearchResult {
  match?: Item | null;
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

  describe('auto-fix', () => {
    it('rewrites T | null as Maybe<T> and adds the import', () => {
      const input = `type Foo = string | null;\n`;
      const output = fixCode(input);
      expect(output).toContain('type Foo = Maybe<string>;');
      expect(output).toContain("import type { Maybe } from '@dereekb/util';");
    });

    it('does not rewrite T | undefined (rule does not target undefined-only unions)', () => {
      const input = `type Foo = string | undefined;\n`;
      const output = fixCode(input);
      expect(output).toBe(input);
    });

    it('rewrites T | null | undefined as Maybe<T>', () => {
      const input = `type Foo = string | null | undefined;\n`;
      const output = fixCode(input);
      expect(output).toContain('type Foo = Maybe<string>;');
    });

    it('rewrites A | B | null as Maybe<A | B>', () => {
      const input = `type Foo = string | number | null;\n`;
      const output = fixCode(input);
      expect(output).toContain('type Foo = Maybe<string | number>;');
    });

    it('does not add a duplicate import when Maybe is already imported from @dereekb/util', () => {
      const input = `import { Maybe } from '@dereekb/util';\ntype Foo = string | null;\n`;
      const output = fixCode(input);
      // Original import preserved; no second `import type` added by our rule.
      const importLines = output.split('\n').filter((line) => line.includes("from '@dereekb/util'"));
      expect(importLines).toHaveLength(1);
      expect(output).toContain('type Foo = Maybe<string>;');
    });

    it('adds the import only once even when multiple unions are flagged', () => {
      const input = `
type A = string | null;
type B = number | null | undefined;
type C = boolean | null;
`;
      const output = fixCode(input);
      const importLines = output.split('\n').filter((line) => line.includes("from '@dereekb/util'"));
      expect(importLines).toHaveLength(1);
      expect(output).toContain('type A = Maybe<string>;');
      expect(output).toContain('type B = Maybe<number>;');
      expect(output).toContain('type C = Maybe<boolean>;');
    });

    it('inserts the new import before existing imports', () => {
      const input = `import { foo } from './foo';\ntype X = string | null;\n`;
      const output = fixCode(input);
      const newImportIdx = output.indexOf("import type { Maybe } from '@dereekb/util';");
      const existingImportIdx = output.indexOf("import { foo } from './foo';");
      expect(newImportIdx).toBeGreaterThanOrEqual(0);
      expect(existingImportIdx).toBeGreaterThanOrEqual(0);
      expect(newImportIdx).toBeLessThan(existingImportIdx);
    });

    it('preserves union member source text (handles generics)', () => {
      const input = `type Foo = Array<string> | null;\n`;
      const output = fixCode(input);
      expect(output).toContain('type Foo = Maybe<Array<string>>;');
    });
  });

  describe('noAutoImport option', () => {
    it('still reports T | null when noAutoImport is true', () => {
      const errors = lintCode(`type Foo = string | null;\n`, { noAutoImport: true });
      expect(errors).toHaveLength(1);
    });

    it('emits the relative-path message when noAutoImport is true', () => {
      const errors = lintCode(`type Foo = string | null;\n`, { noAutoImport: true });
      expect(errors[0].messageId).toBe('preferMaybeNoAutoImport');
      expect(errors[0].message).toContain('relative path');
      expect(errors[0].message).toContain("'../value/maybe.type'");
    });

    it('does not auto-fix when noAutoImport is true', () => {
      const input = `type Foo = string | null;\n`;
      const output = fixCode(input, { noAutoImport: true });
      expect(output).toBe(input);
      expect(output).not.toContain('Maybe<string>');
      expect(output).not.toContain("from '@dereekb/util'");
    });

    it('does not affect T | undefined (still untouched with noAutoImport)', () => {
      const errors = lintCode(`type Foo = string | undefined;\n`, { noAutoImport: true });
      expect(errors).toHaveLength(0);
    });

    it('uses the default messageId when noAutoImport is unset', () => {
      const errors = lintCode(`type Foo = string | null;\n`);
      expect(errors[0].messageId).toBe('preferMaybe');
    });
  });
});
