import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { UTIL_ESLINT_PLUGIN } from './plugin';

function buildConfig(options?: Record<string, unknown>): Linter.Config[] {
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
        'dereekb-util/require-dbx-util-companion-tags': options === undefined ? 'error' : ['error', options]
      }
    }
  ];
}

function lintCode(code: string, options?: Record<string, unknown>): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(options), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-dbx-util-companion-tags');
}

function fixCode(code: string, options?: Record<string, unknown>): string {
  const linter = new Linter({ configType: 'flat' });
  return linter.verifyAndFix(code, buildConfig(options), { filename: 'test.ts' }).output;
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) {
    out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  }
  return out;
}

describe('require-dbx-util-companion-tags rule', () => {
  describe('passes when JSDoc has no @dbxUtil', () => {
    it('plain JSDoc is ignored', () => {
      const errors = lintCode(`
/**
 * A regular function.
 *
 * @param x - The value.
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('canonical @dbxUtil JSDoc', () => {
    it('passes with all required tags present', () => {
      const errors = lintCode(`
/**
 * Reduces booleans.
 *
 * @param array - The boolean values to reduce.
 * @returns The result.
 *
 * @dbxUtil
 * @dbxUtilCategory boolean
 * @dbxUtilKind function
 * @dbxUtilTags boolean, reduce, and, every
 * @dbxUtilRelated reduce-booleans-with-or, reduce-booleans-with-and-fn
 */
function reduceBooleansWithAnd(array: boolean[]): boolean { return false; }
`);
      expect(errors).toHaveLength(0);
    });

    it('passes with only the required @dbxUtilCategory companion', () => {
      const errors = lintCode(`
/**
 * Builds something.
 *
 * @returns The result.
 *
 * @dbxUtil
 * @dbxUtilCategory factory
 */
function buildSomething(): void {}
`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('missing category', () => {
    it('flags @dbxUtil without @dbxUtilCategory', () => {
      const errors = lintCode(`
/**
 * Does work.
 *
 * @dbxUtil
 */
function doWork(): void {}
`);
      expect(messagesById(errors).missingCategory).toBe(1);
    });
  });

  describe('category format', () => {
    it('flags empty category', () => {
      const errors = lintCode(`
/**
 * Work.
 *
 * @dbxUtil
 * @dbxUtilCategory
 */
function work(): void {}
`);
      expect(messagesById(errors).emptyCategory).toBe(1);
    });

    it('flags non-kebab-case category', () => {
      const errors = lintCode(`
/**
 * Work.
 *
 * @dbxUtil
 * @dbxUtilCategory Boolean_Things
 */
function work(): void {}
`);
      expect(messagesById(errors).invalidCategoryFormat).toBe(1);
    });

    it('accepts kebab-case multi-word category', () => {
      const errors = lintCode(`
/**
 * Work.
 *
 * @dbxUtil
 * @dbxUtilCategory date-range
 */
function work(): void {}
`);
      expect(errors).toHaveLength(0);
    });

    it('honors allowedCategories option', () => {
      const errors = lintCode(
        `
/**
 * Work.
 *
 * @dbxUtil
 * @dbxUtilCategory unknown-thing
 */
function work(): void {}
`,
        { allowedCategories: ['boolean', 'date', 'array'] }
      );
      expect(messagesById(errors).invalidCategoryFormat).toBe(1);
    });
  });

  describe('kind enum', () => {
    it('flags invalid kind value', () => {
      const errors = lintCode(`
/**
 * Work.
 *
 * @dbxUtil
 * @dbxUtilCategory boolean
 * @dbxUtilKind helper
 */
function work(): void {}
`);
      expect(messagesById(errors).invalidKind).toBe(1);
    });

    it('accepts each allowed kind', () => {
      for (const kind of ['function', 'class', 'const', 'factory']) {
        const errors = lintCode(`
/**
 * Work.
 *
 * @dbxUtil
 * @dbxUtilCategory boolean
 * @dbxUtilKind ${kind}
 */
function work(): void {}
`);
        expect(messagesById(errors).invalidKind ?? 0).toBe(0);
      }
    });
  });

  describe('related slugs', () => {
    it('flags camelCase related entries', () => {
      const errors = lintCode(`
/**
 * Work.
 *
 * @dbxUtil
 * @dbxUtilCategory boolean
 * @dbxUtilRelated reduceBooleansWithOr, reduce-booleans-with-and-fn
 */
function work(): void {}
`);
      expect(messagesById(errors).relatedNotKebab).toBe(1);
    });

    it('accepts all-kebab related entries', () => {
      const errors = lintCode(`
/**
 * Work.
 *
 * @dbxUtil
 * @dbxUtilCategory boolean
 * @dbxUtilRelated reduce-booleans-with-or, reduce-booleans-with-and-fn
 */
function work(): void {}
`);
      expect(messagesById(errors).relatedNotKebab ?? 0).toBe(0);
    });
  });

  describe('tags lowercase', () => {
    it('flags uppercase tag tokens', () => {
      const errors = lintCode(`
/**
 * Work.
 *
 * @dbxUtil
 * @dbxUtilCategory boolean
 * @dbxUtilTags Boolean, Reduce
 */
function work(): void {}
`);
      expect(messagesById(errors).tagsNotLowercase).toBeGreaterThanOrEqual(1);
    });

    it('auto-fixes uppercase tokens to lowercase', () => {
      const fixed = fixCode(`
/**
 * Work.
 *
 * @dbxUtil
 * @dbxUtilCategory boolean
 * @dbxUtilTags Boolean, Reduce
 */
function work(): void {}
`);
      expect(fixed).toContain('@dbxUtilTags boolean, reduce');
    });
  });

  describe('unknown / duplicate tags', () => {
    it('flags unknown @dbxUtil* tag (typo)', () => {
      const errors = lintCode(`
/**
 * Work.
 *
 * @dbxUtil
 * @dbxUtilCategory boolean
 * @dbxUtilCateogry boolean
 */
function work(): void {}
`);
      expect(messagesById(errors).unknownDbxUtilTag).toBe(1);
    });

    it('flags multiple @dbxUtilCategory tags', () => {
      const errors = lintCode(`
/**
 * Work.
 *
 * @dbxUtil
 * @dbxUtilCategory boolean
 * @dbxUtilCategory date
 */
function work(): void {}
`);
      expect(messagesById(errors).multipleCategoryTags).toBe(1);
    });

    it('flags duplicate @dbxUtilKind tags', () => {
      const errors = lintCode(`
/**
 * Work.
 *
 * @dbxUtil
 * @dbxUtilCategory boolean
 * @dbxUtilKind function
 * @dbxUtilKind factory
 */
function work(): void {}
`);
      expect(messagesById(errors).duplicateCompanionTag).toBe(1);
    });
  });

  describe('non-function exports', () => {
    it('applies to a class declaration', () => {
      const errors = lintCode(`
/**
 * The thing.
 *
 * @dbxUtil
 */
class Foo {}
`);
      expect(messagesById(errors).missingCategory).toBe(1);
    });

    it('applies to a type alias', () => {
      const errors = lintCode(`
/**
 * Maybe.
 *
 * @dbxUtil
 */
type MaybeNumber = number | undefined;
`);
      expect(messagesById(errors).missingCategory).toBe(1);
    });
  });
});
