import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { utilEslintPlugin } from './plugin';

function buildConfig(options?: Record<string, unknown>): Linter.Config[] {
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
        'dereekb-util/prefer-canonical-jsdoc': options === undefined ? 'error' : ['error', options]
      }
    }
  ];
}

function lintCode(code: string, options?: Record<string, unknown>): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(options), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/prefer-canonical-jsdoc');
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) {
    out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  }
  return out;
}

describe('prefer-canonical-jsdoc rule', () => {
  describe('canonical examples — should not warn', () => {
    it('canonical function JSDoc passes', () => {
      const errors = lintCode(`
/**
 * Reduces an array of booleans with the logical AND operation.
 *
 * @param array - Array of boolean values to reduce.
 * @param emptyArrayValue - Value to return if the array is empty.
 * @returns The result of ANDing all boolean values in the array.
 * @throws {TypeError} If the array is empty and no emptyArrayValue is provided.
 *
 * @dbxUtil
 * @dbxUtilCategory boolean
 *
 * @example
 * \`\`\`ts
 * reduceBooleansWithAnd([true, true]);
 * \`\`\`
 */
function reduceBooleansWithAnd(array: boolean[], emptyArrayValue?: boolean): boolean {
  let result = false;
  return result;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('canonical class method JSDoc passes', () => {
      const errors = lintCode(`
class Foo {
  /**
   * Adds one to the input.
   *
   * @param x - The input value.
   * @returns The input value plus one.
   */
  bar(x: number): number {
    return x + 1;
  }
}
`);
      expect(errors).toHaveLength(0);
    });

    it('canonical arrow function JSDoc passes', () => {
      const errors = lintCode(`
/**
 * Doubles the input value.
 *
 * @param x - The input value.
 * @returns The doubled value.
 */
export const double = (x: number) => x * 2;
`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('description format', () => {
    it('flags description missing terminal punctuation', () => {
      const errors = lintCode(`
/**
 * Adds one to the input
 *
 * @param x - The value.
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(messagesById(errors).descriptionMissingPeriod).toBe(1);
    });

    it('flags description missing capital', () => {
      const errors = lintCode(`
/**
 * adds one to the input.
 *
 * @param x - The value.
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(messagesById(errors).descriptionMissingCapital).toBe(1);
    });

    it('flags paragraph separator with two blank lines', () => {
      const errors = lintCode(`
/**
 * First paragraph.
 *
 *
 * Second paragraph.
 *
 * @param x - The value.
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(messagesById(errors).descriptionParagraphSeparator).toBeGreaterThanOrEqual(1);
    });
  });

  describe('@param format', () => {
    it('flags @param missing hyphen', () => {
      const errors = lintCode(`
/**
 * Adds one.
 *
 * @param x the input value.
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(messagesById(errors).paramHyphen).toBe(1);
    });

    it('flags @param description missing capital', () => {
      const errors = lintCode(`
/**
 * Adds one.
 *
 * @param x - the input value.
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(messagesById(errors).paramDescriptionCapital).toBe(1);
    });

    it('flags @param description missing period', () => {
      const errors = lintCode(`
/**
 * Adds one.
 *
 * @param x - The input value
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(messagesById(errors).paramDescriptionPeriod).toBe(1);
    });

    it('flags @param out of order', () => {
      const errors = lintCode(`
/**
 * Adds two numbers.
 *
 * @param b - Second.
 * @param a - First.
 * @returns The sum.
 */
function foo(a: number, b: number): number { return a + b; }
`);
      expect(messagesById(errors).paramOrder).toBeGreaterThanOrEqual(1);
    });
  });

  describe('@returns format', () => {
    it('flags @returns using hyphen', () => {
      const errors = lintCode(`
/**
 * Adds one.
 *
 * @param x - The value.
 * @returns - The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(messagesById(errors).returnsNoHyphen).toBe(1);
    });

    it('flags @returns missing period', () => {
      const errors = lintCode(`
/**
 * Adds one.
 *
 * @param x - The value.
 * @returns The result
 */
function foo(x: number): number { return x + 1; }
`);
      expect(messagesById(errors).returnsDescriptionPeriod).toBe(1);
    });

    it('flags @returns missing capital', () => {
      const errors = lintCode(`
/**
 * Adds one.
 *
 * @param x - The value.
 * @returns the result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(messagesById(errors).returnsDescriptionCapital).toBe(1);
    });
  });

  describe('@throws format', () => {
    it('flags @throws missing brace-wrapped error type', () => {
      const errors = lintCode(`
/**
 * Asserts non-empty.
 *
 * @param x - The value.
 * @returns The value.
 * @throws if the input is empty.
 */
function foo(x: string): string { return x; }
`);
      expect(messagesById(errors).throwsErrorType).toBe(1);
    });

    it('flags @throws description missing capital', () => {
      const errors = lintCode(`
/**
 * Asserts non-empty.
 *
 * @param x - The value.
 * @returns The value.
 * @throws {TypeError} if the input is empty.
 */
function foo(x: string): string { return x; }
`);
      expect(messagesById(errors).throwsDescriptionCapital).toBe(1);
    });
  });

  describe('tag order', () => {
    it('flags @example before @returns', () => {
      const errors = lintCode(`
/**
 * Adds one.
 *
 * @param x - The value.
 *
 * @example
 * \`\`\`ts
 * foo(1);
 * \`\`\`
 *
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(messagesById(errors).tagOrder).toBeGreaterThanOrEqual(1);
    });

    it('flags @throws before @returns', () => {
      const errors = lintCode(`
/**
 * Adds one.
 *
 * @param x - The value.
 * @throws {Error} On error.
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(messagesById(errors).tagOrder).toBeGreaterThanOrEqual(1);
    });
  });

  describe('@example fence', () => {
    it('flags @example without fenced block', () => {
      const errors = lintCode(`
/**
 * Adds one.
 *
 * @param x - The value.
 * @returns The result.
 *
 * @example foo(1)
 */
function foo(x: number): number { return x + 1; }
`);
      expect(messagesById(errors).exampleFence).toBe(1);
    });
  });

  describe('type-restating heuristic', () => {
    it('flags @param description starting with "a string"', () => {
      const errors = lintCode(`
/**
 * Adds one.
 *
 * @param x - A string value to process.
 * @returns The result.
 */
function foo(x: string): string { return x; }
`);
      expect(messagesById(errors).descriptionTypeRestating).toBeGreaterThanOrEqual(1);
    });

    it('flags @returns description starting with "an array of"', () => {
      const errors = lintCode(`
/**
 * Builds entries.
 *
 * @param n - Count.
 * @returns An array of entries.
 */
function foo(n: number): number[] { return []; }
`);
      expect(messagesById(errors).descriptionTypeRestating).toBeGreaterThanOrEqual(1);
    });

    it('passes when @param description describes purpose', () => {
      const errors = lintCode(`
/**
 * Adds one.
 *
 * @param x - Input numeric value.
 * @returns Numeric result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(messagesById(errors).descriptionTypeRestating ?? 0).toBe(0);
    });
  });

  describe('single-line on functions', () => {
    it('flags single-line JSDoc on a function with parameters', () => {
      const errors = lintCode(`
/** Adds one. */
function foo(x: number): number { return x + 1; }
`);
      expect(messagesById(errors).functionShouldBeMultiline).toBe(1);
    });

    it('passes for single-line JSDoc on a no-param function', () => {
      const errors = lintCode(`
/** Greets the user. */
function greet(): void { console.log('hi'); }
`);
      expect(messagesById(errors).functionShouldBeMultiline ?? 0).toBe(0);
    });
  });
});
