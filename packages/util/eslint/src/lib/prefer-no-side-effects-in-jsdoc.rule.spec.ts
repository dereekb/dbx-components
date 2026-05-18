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

    it('flags overloaded function whose JSDoc has the tag but impl has no surviving annotation', () => {
      const errors = lintCode(`
/**
 * Builds a Foo with overloads.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeFoo(a: number): number;
export function makeFoo(a: string): string;
export function makeFoo(a: any): any { return a; }
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingImplAnnotationOverloaded');
      expect(errors[0].message).toContain('makeFoo');
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

    it('preserves the impl-leading line comment on overloaded functions and mirrors the tag into the JSDoc', () => {
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
      // The impl line comment is required for tree-shaking (TS erases overload-signature JSDoc) and must remain.
      expect(output).toContain('// @__NO_SIDE_EFFECTS__');
      // The JSDoc on the first overload should also carry the tag so consumers see it in tooltips.
      const jsdocBlock = output.slice(output.indexOf('/**'), output.indexOf('*/') + 2);
      expect(jsdocBlock).toContain('@__NO_SIDE_EFFECTS__');
      expect(jsdocBlock).toContain('Builds a Foo with overloads.');
      // Sanity: only one line-comment occurrence (no duplicate orphans introduced).
      expect((output.match(/\/\/ @__NO_SIDE_EFFECTS__/g) ?? []).length).toBe(1);
    });

    it('removes orphans between overloads but keeps the impl-leading line comment', () => {
      const input = `
/**
 * Builds a Foo with overloads.
 */
export function makeFoo(a: number): number;
// @__NO_SIDE_EFFECTS__
export function makeFoo(a: string): string;
// @__NO_SIDE_EFFECTS__
export function makeFoo(a: any): any { return a; }
`;
      const output = fixCode(input);
      // Exactly one line comment survives — the one above the impl. The between-overloads orphan is removed.
      expect((output.match(/\/\/ @__NO_SIDE_EFFECTS__/g) ?? []).length).toBe(1);
      const jsdocBlock = output.slice(output.indexOf('/**'), output.indexOf('*/') + 2);
      expect(jsdocBlock).toContain('@__NO_SIDE_EFFECTS__');
      // The remaining line comment must sit between the last overload and the impl.
      const lastOverloadIdx = output.indexOf('export function makeFoo(a: string)');
      const implIdx = output.indexOf('export function makeFoo(a: any)');
      const lineCommentIdx = output.indexOf('// @__NO_SIDE_EFFECTS__');
      expect(lineCommentIdx).toBeGreaterThan(lastOverloadIdx);
      expect(lineCommentIdx).toBeLessThan(implIdx);
    });

    it('inserts impl-leading line comment when overloaded JSDoc has the tag but impl has no surviving annotation', () => {
      const input = `
/**
 * Builds a Foo.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeFoo(a: number): number;
export function makeFoo(a: string): string;
export function makeFoo(a: any): any { return a; }
`;
      const output = fixCode(input);
      // Line comment now sits between the last overload and the impl.
      const lastOverloadIdx = output.indexOf('export function makeFoo(a: string)');
      const implIdx = output.indexOf('export function makeFoo(a: any)');
      const lineCommentIdx = output.indexOf('// @__NO_SIDE_EFFECTS__');
      expect(lineCommentIdx).toBeGreaterThan(lastOverloadIdx);
      expect(lineCommentIdx).toBeLessThan(implIdx);
      // Original JSDoc tag still present — the rule does not duplicate it.
      const jsdocBlock = output.slice(output.indexOf('/**'), output.indexOf('*/') + 2);
      expect((jsdocBlock.match(/@__NO_SIDE_EFFECTS__/g) ?? []).length).toBe(1);
    });

    it('overloaded function in the desired final state (JSDoc tag + impl line comment) is left alone', () => {
      const input = `
/**
 * Builds a Foo.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeFoo(a: number): number;
export function makeFoo(a: string): string;
// @__NO_SIDE_EFFECTS__
export function makeFoo(a: any): any { return a; }
`;
      const errors = lintCode(input);
      expect(errors).toHaveLength(0);
      // Idempotent under --fix.
      const output = fixCode(input);
      expect(output).toBe(input);
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
