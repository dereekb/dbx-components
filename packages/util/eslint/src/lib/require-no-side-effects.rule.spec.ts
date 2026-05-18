import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { UTIL_ESLINT_PLUGIN } from './plugin';

interface LintOptions {
  readonly checkNamePatterns?: boolean;
  readonly additionalNamePatterns?: readonly string[];
}

function buildConfig(options?: LintOptions): Linter.Config[] {
  const ruleOptions = options ? ['error', options] : ['error'];

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
        'dereekb-util/require-no-side-effects': ruleOptions as any
      }
    }
  ];
}

function lintCode(code: string, options?: LintOptions): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(options), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-no-side-effects');
}

function fixCode(code: string, options?: LintOptions): string {
  const linter = new Linter({ configType: 'flat' });
  const result = linter.verifyAndFix(code, buildConfig(options), { filename: 'test.ts' });
  return result.output;
}

describe('require-no-side-effects rule', () => {
  describe('valid', () => {
    it('factory-tagged function with @__NO_SIDE_EFFECTS__ inside JSDoc', () => {
      const errors = lintCode(`
/**
 * @dbxUtilKind factory
 * @__NO_SIDE_EFFECTS__
 */
export function makeFooFactory() { return 1; }
`);
      expect(errors).toHaveLength(0);
    });

    it('non-factory function without the tag is ignored', () => {
      const errors = lintCode(`
/** A regular helper. */
export function doSomething() { return 1; }
`);
      expect(errors).toHaveLength(0);
    });

    it('overload signatures are skipped — only the implementation is checked', () => {
      const errors = lintCode(`
/**
 * @dbxUtilKind factory
 */
export function overloaded(): number;
export function overloaded(x: number): number;
/**
 * @dbxUtilKind factory
 * @__NO_SIDE_EFFECTS__
 */
export function overloaded(x?: number): number { return x ?? 0; }
`);
      expect(errors).toHaveLength(0);
    });

    it('overloaded factory with JSDoc tag on first overload AND impl line comment passes', () => {
      const errors = lintCode(`
/**
 * @dbxUtilKind factory
 * @__NO_SIDE_EFFECTS__
 */
export function makeFoo(a: number): number;
export function makeFoo(a: string): string;
// @__NO_SIDE_EFFECTS__
export function makeFoo(a: any): any { return a; }
`);
      expect(errors).toHaveLength(0);
    });

    it('name-pattern match without checkNamePatterns option is ignored', () => {
      const errors = lintCode(`
export function makeFooService() { return 1; }
`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid — JSDoc tag detection', () => {
    it('flags factory-tagged function missing the annotation', () => {
      const errors = lintCode(`
/**
 * @dbxUtilKind factory
 */
export function makeFooFactory() { return 1; }
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('makeFooFactory');
      expect(errors[0].message).toContain('@__NO_SIDE_EFFECTS__');
    });

    it('flags factory-tagged function with @__NO_SIDE_EFFECTS__ as a separate line comment, not in JSDoc', () => {
      const errors = lintCode(`
/**
 * @dbxUtilKind factory
 */
// @__NO_SIDE_EFFECTS__
export function makeFooFactory() { return 1; }
`);
      expect(errors).toHaveLength(1);
    });

    it('flags overloaded factory with JSDoc tag on first overload but no impl-leading annotation', () => {
      const errors = lintCode(`
/**
 * @dbxUtilKind factory
 * @__NO_SIDE_EFFECTS__
 */
export function makeFoo(a: number): number;
export function makeFoo(a: string): string;
export function makeFoo(a: any): any { return a; }
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('makeFoo');
      expect(errors[0].message).toContain('overload');
      expect(errors[0].messageId).toBe('missingImplAnnotationOverloaded');
    });

    it('flags overloaded factory with no annotations anywhere', () => {
      const errors = lintCode(`
/**
 * @dbxUtilKind factory
 */
export function makeFoo(a: number): number;
export function makeFoo(a: string): string;
export function makeFoo(a: any): any { return a; }
`);
      expect(errors).toHaveLength(1);
    });
  });

  describe('invalid — name-pattern detection (option enabled)', () => {
    it('flags suffix-matched function when checkNamePatterns is true', () => {
      const errors = lintCode(`export function makeFooFactory() { return 1; }`, { checkNamePatterns: true });
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('makeFooFactory');
    });

    it('flags additionalNamePatterns match', () => {
      const errors = lintCode(`export function specialPatternFn() { return 1; }`, {
        checkNamePatterns: true,
        additionalNamePatterns: ['^specialPattern']
      });
      expect(errors).toHaveLength(1);
    });
  });

  describe('auto-fix', () => {
    it('inserts @__NO_SIDE_EFFECTS__ as the last line of the JSDoc', () => {
      const input = `
/**
 * @dbxUtilKind factory
 */
export function makeFooFactory() { return 1; }
`;
      const output = fixCode(input);
      expect(output).toContain('@dbxUtilKind factory');
      expect(output).toContain('@__NO_SIDE_EFFECTS__');
      const factoryIdx = output.indexOf('@dbxUtilKind factory');
      const noSideIdx = output.indexOf('@__NO_SIDE_EFFECTS__');
      expect(noSideIdx).toBeGreaterThan(factoryIdx);
      const closingIdx = output.indexOf('*/');
      expect(noSideIdx).toBeLessThan(closingIdx);
    });

    it('removes redundant `// @__NO_SIDE_EFFECTS__` after migrating into the JSDoc', () => {
      const input = `
/**
 * @dbxUtilKind factory
 */
// @__NO_SIDE_EFFECTS__
export function makeFooFactory() { return 1; }
`;
      const output = fixCode(input);
      expect(output).toContain('@__NO_SIDE_EFFECTS__');
      // Should appear in JSDoc, not as standalone line comment.
      expect(output).not.toContain('// @__NO_SIDE_EFFECTS__');
      // JSDoc should contain it.
      const jsdocBlock = output.slice(output.indexOf('/**'), output.indexOf('*/') + 2);
      expect(jsdocBlock).toContain('@__NO_SIDE_EFFECTS__');
    });

    it('expands a single-line JSDoc to multi-line when adding the annotation', () => {
      const input = `
/** @dbxUtilKind factory */
export function makeFooFactory() { return 1; }
`;
      const output = fixCode(input);
      expect(output).toContain('@dbxUtilKind factory');
      expect(output).toContain('@__NO_SIDE_EFFECTS__');
      // Multi-line form: contains a newline between the two tags.
      expect(/\* @dbxUtilKind factory[\r\n]+\s*\* @__NO_SIDE_EFFECTS__/.test(output)).toBe(true);
    });

    it('creates a JSDoc when name-pattern matches a function with no JSDoc', () => {
      const input = `export function makeFooFactory() { return 1; }\n`;
      const output = fixCode(input, { checkNamePatterns: true });
      expect(output).toContain('/**');
      expect(output).toContain('@dbxUtilKind factory');
      expect(output).toContain('@__NO_SIDE_EFFECTS__');
    });

    it('handles overloaded factory functions — adds JSDoc tag AND impl-leading line comment', () => {
      const input = `
/**
 * @dbxUtilKind factory
 */
export function makeFoo(a: number): number;
export function makeFoo(a: string): string;
export function makeFoo(a: any): any { return a; }
`;
      const output = fixCode(input);
      // JSDoc on first overload now carries the tag.
      const jsdocBlock = output.slice(output.indexOf('/**'), output.indexOf('*/') + 2);
      expect(jsdocBlock).toContain('@__NO_SIDE_EFFECTS__');
      // The bundler-required line comment now sits directly above the implementation.
      const lastOverloadIdx = output.indexOf('export function makeFoo(a: string)');
      const implIdx = output.indexOf('export function makeFoo(a: any)');
      const lineCommentIdx = output.indexOf('// @__NO_SIDE_EFFECTS__');
      expect(lineCommentIdx).toBeGreaterThan(lastOverloadIdx);
      expect(lineCommentIdx).toBeLessThan(implIdx);
    });

    it('adds only the impl-leading line comment when JSDoc on first overload already carries the tag', () => {
      const input = `
/**
 * @dbxUtilKind factory
 * @__NO_SIDE_EFFECTS__
 */
export function makeFoo(a: number): number;
export function makeFoo(a: string): string;
export function makeFoo(a: any): any { return a; }
`;
      const output = fixCode(input);
      // JSDoc untouched (single occurrence of the tag inside it).
      const jsdocBlock = output.slice(output.indexOf('/**'), output.indexOf('*/') + 2);
      expect((jsdocBlock.match(/@__NO_SIDE_EFFECTS__/g) ?? []).length).toBe(1);
      // Line comment inserted above the impl.
      const implIdx = output.indexOf('export function makeFoo(a: any)');
      const lineCommentIdx = output.indexOf('// @__NO_SIDE_EFFECTS__');
      expect(lineCommentIdx).toBeGreaterThan(0);
      expect(lineCommentIdx).toBeLessThan(implIdx);
    });

    it('preserves existing JSDoc text and indentation', () => {
      const input = `
  /**
   * Builds a Foo factory used by callers across the workspace.
   *
   * @dbxUtilKind factory
   * @returns A Foo instance
   */
  export function makeFooFactory() { return 1; }
`;
      const output = fixCode(input);
      expect(output).toContain('Builds a Foo factory used by callers across the workspace.');
      expect(output).toContain('@returns A Foo instance');
      expect(output).toContain('@__NO_SIDE_EFFECTS__');
    });
  });
});
