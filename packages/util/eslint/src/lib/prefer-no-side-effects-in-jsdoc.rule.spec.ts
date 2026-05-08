import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { utilEslintPlugin } from './plugin';

function buildConfig(): Linter.Config[] {
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
        'dereekb-util/prefer-no-side-effects-in-jsdoc': 'error'
      }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/prefer-no-side-effects-in-jsdoc');
}

function fixCode(code: string): string {
  const linter = new Linter({ configType: 'flat' });
  const result = linter.verifyAndFix(code, buildConfig(), { filename: 'test.ts' });
  return result.output;
}

describe('prefer-no-side-effects-in-jsdoc rule', () => {
  describe('valid', () => {
    it('annotation already inside JSDoc with no orphan line comment', () => {
      const errors = lintCode(`
/**
 * @__NO_SIDE_EFFECTS__
 */
export function makeFoo() { return 1; }
`);
      expect(errors).toHaveLength(0);
    });

    it('orphan line comment with no JSDoc to migrate into is left alone', () => {
      const errors = lintCode(`
// @__NO_SIDE_EFFECTS__
export function makeFoo() { return 1; }
`);
      expect(errors).toHaveLength(0);
    });

    it('function with neither annotation form is ignored', () => {
      const errors = lintCode(`
export function plainHelper() { return 1; }
`);
      expect(errors).toHaveLength(0);
    });

    it('JSDoc-only function (no orphan) without the tag is ignored — this rule only triggers on relocation', () => {
      const errors = lintCode(`
/**
 * Helper that does something.
 */
export function plainHelper() { return 1; }
`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid', () => {
    it('flags function with JSDoc plus adjacent `// @__NO_SIDE_EFFECTS__`', () => {
      const errors = lintCode(`
/**
 * Builds a Foo.
 */
// @__NO_SIDE_EFFECTS__
export function makeFoo() { return 1; }
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('makeFoo');
    });

    it('flags function with JSDoc plus adjacent `/* @__NO_SIDE_EFFECTS__ */` block comment', () => {
      const errors = lintCode(`
/**
 * Builds a Foo.
 */
/* @__NO_SIDE_EFFECTS__ */
export function makeFoo() { return 1; }
`);
      expect(errors).toHaveLength(1);
    });
  });

  describe('auto-fix', () => {
    it('migrates the line comment into the JSDoc as the last tag', () => {
      const input = `
/**
 * Builds a Foo.
 */
// @__NO_SIDE_EFFECTS__
export function makeFoo() { return 1; }
`;
      const output = fixCode(input);
      expect(output).not.toContain('// @__NO_SIDE_EFFECTS__');
      const jsdocBlock = output.slice(output.indexOf('/**'), output.indexOf('*/') + 2);
      expect(jsdocBlock).toContain('@__NO_SIDE_EFFECTS__');
      // Annotation should be the last tag — appear after the description.
      expect(/Builds a Foo[\s\S]*@__NO_SIDE_EFFECTS__/.test(jsdocBlock)).toBe(true);
    });

    it('preserves existing JSDoc body and indentation', () => {
      const input = `
  /**
   * Builds a Foo factory.
   *
   * @returns A Foo
   */
  // @__NO_SIDE_EFFECTS__
  export function makeFoo() { return 1; }
`;
      const output = fixCode(input);
      expect(output).toContain('Builds a Foo factory.');
      expect(output).toContain('@returns A Foo');
      expect(output).toContain('@__NO_SIDE_EFFECTS__');
      expect(output).not.toContain('// @__NO_SIDE_EFFECTS__');
    });

    it('expands a single-line JSDoc to multi-line when migrating', () => {
      const input = `
/** Builds a Foo. */
// @__NO_SIDE_EFFECTS__
export function makeFoo() { return 1; }
`;
      const output = fixCode(input);
      expect(output).not.toContain('// @__NO_SIDE_EFFECTS__');
      expect(/\* Builds a Foo\.[\r\n]+\s*\* @__NO_SIDE_EFFECTS__/.test(output)).toBe(true);
    });

    it('handles overloaded functions — JSDoc on first overload, orphan above implementation', () => {
      const input = `
/**
 * Builds a Foo with overloads.
 */
export function makeFoo(a: number): number;
export function makeFoo(a: string): string;
// @__NO_SIDE_EFFECTS__
export function makeFoo(a: any): any { return a; }
`;
      const output = fixCode(input);
      expect(output).not.toContain('// @__NO_SIDE_EFFECTS__');
      const jsdocBlock = output.slice(output.indexOf('/**'), output.indexOf('*/') + 2);
      expect(jsdocBlock).toContain('@__NO_SIDE_EFFECTS__');
      expect(jsdocBlock).toContain('Builds a Foo with overloads.');
    });

    it('idempotent — does not duplicate the tag if JSDoc already has it', () => {
      const input = `
/**
 * Builds a Foo.
 *
 * @__NO_SIDE_EFFECTS__
 */
// @__NO_SIDE_EFFECTS__
export function makeFoo() { return 1; }
`;
      const output = fixCode(input);
      // Orphan removed.
      expect(output).not.toContain('// @__NO_SIDE_EFFECTS__');
      // Only one occurrence inside the JSDoc.
      const matches = output.match(/@__NO_SIDE_EFFECTS__/g) ?? [];
      expect(matches).toHaveLength(1);
    });
  });
});
