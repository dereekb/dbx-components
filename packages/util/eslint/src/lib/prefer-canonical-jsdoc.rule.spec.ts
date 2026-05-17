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

function fixCode(code: string, options?: Record<string, unknown>): string {
  const linter = new Linter({ configType: 'flat' });
  const result = linter.verifyAndFix(code, buildConfig(options), { filename: 'test.ts' });
  return result.output;
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

    it('treats JSDoc dot-notation `input.foo` as referring to the parent `input` param', () => {
      const errors = lintCode(`
/**
 * Parses input.
 *
 * @param input.a - First sub-field.
 * @param input.b - Second sub-field.
 * @returns The result.
 */
function parse(input: { a: string; b: string }): string { return input.a + input.b; }
`);
      expect(messagesById(errors).paramOrder ?? 0).toBe(0);
    });

    it('does not treat TypeScript `this` parameter as a positional @param', () => {
      const errors = lintCode(`
/**
 * Asserts something.
 *
 * @param received - The value under test.
 * @param expected - The reference value.
 * @returns The result.
 */
function check(this: { isNot: boolean }, received: number, expected: number): number { return received - expected; }
`);
      expect(messagesById(errors).paramOrder ?? 0).toBe(0);
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

    it('flags bare "the {type}" descriptions that add no purpose', () => {
      const errors = lintCode(`
/**
 * Stores a set.
 *
 * @param values - The set.
 * @returns The set.
 */
function foo(values: Set<number>): Set<number> { return values; }
`);
      expect(messagesById(errors).descriptionTypeRestating).toBeGreaterThanOrEqual(1);
    });

    it('flags "the {type} value" descriptions that add no purpose', () => {
      const errors = lintCode(`
/**
 * Stores a value.
 *
 * @param v - The string value.
 * @returns Numeric result.
 */
function foo(v: string): number { return v.length; }
`);
      expect(messagesById(errors).descriptionTypeRestating).toBeGreaterThanOrEqual(1);
    });

    it('passes when "the {type} ..." description adds purpose info', () => {
      const errors = lintCode(`
/**
 * Copies a set.
 *
 * @param source - The set to copy.
 * @param fn - Callback that mutates the copied set.
 * @returns The copied set.
 */
function copy<T>(source: Set<T>, fn: (s: Set<T>) => void): Set<T> { return new Set(source); }
`);
      // "The set to copy." adds purpose info — should not be flagged.
      // "The copied set." is the @returns description; it's just describing the role of the result.
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

  describe('autofix', () => {
    it('appends terminal punctuation to description', () => {
      const output = fixCode(`
/**
 * Adds one to the input
 *
 * @param x - The value.
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(output).toContain('Adds one to the input.');
    });

    it('capitalizes the description first letter', () => {
      const output = fixCode(`
/**
 * adds one to the input.
 *
 * @param x - The value.
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(output).toContain(' * Adds one to the input.');
    });

    it('collapses runs of blank description-separator lines to one', () => {
      const output = fixCode(`
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
      // No two consecutive blank ` * ` lines should remain.
      expect(/\n \*\n \*\n/.test(output)).toBe(false);
      expect(output).toContain('First paragraph.');
      expect(output).toContain('Second paragraph.');
    });

    it('inserts the canonical hyphen between @param name and description', () => {
      const output = fixCode(`
/**
 * Adds one.
 *
 * @param x the input value.
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(output).toContain('@param x - The input value.');
    });

    it('capitalizes @param description first letter', () => {
      const output = fixCode(`
/**
 * Adds one.
 *
 * @param x - the input value.
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(output).toContain('@param x - The input value.');
    });

    it('appends terminal punctuation to @param description', () => {
      const output = fixCode(`
/**
 * Adds one.
 *
 * @param x - The input value
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(output).toContain('@param x - The input value.');
    });

    it('reorders @param tags to match the declared signature', () => {
      const output = fixCode(`
/**
 * Adds two numbers.
 *
 * @param b - Second.
 * @param a - First.
 * @returns The sum.
 */
function foo(a: number, b: number): number { return a + b; }
`);
      const aIdx = output.indexOf('@param a');
      const bIdx = output.indexOf('@param b');
      expect(aIdx).toBeGreaterThan(-1);
      expect(bIdx).toBeGreaterThan(-1);
      expect(aIdx).toBeLessThan(bIdx);
    });

    it('strips the leading `- ` from @returns', () => {
      const output = fixCode(`
/**
 * Adds one.
 *
 * @param x - The value.
 * @returns - The result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(output).toContain('@returns The result.');
      expect(output).not.toContain('@returns -');
    });

    it('capitalizes @returns description first letter', () => {
      const output = fixCode(`
/**
 * Adds one.
 *
 * @param x - The value.
 * @returns the result.
 */
function foo(x: number): number { return x + 1; }
`);
      expect(output).toContain('@returns The result.');
    });

    it('appends terminal punctuation to @returns description', () => {
      const output = fixCode(`
/**
 * Adds one.
 *
 * @param x - The value.
 * @returns The result
 */
function foo(x: number): number { return x + 1; }
`);
      expect(output).toContain('@returns The result.');
    });

    it('capitalizes @throws description first letter', () => {
      const output = fixCode(`
/**
 * Asserts non-empty.
 *
 * @param x - The value.
 * @returns The value.
 * @throws {TypeError} if the input is empty.
 */
function foo(x: string): string { return x; }
`);
      expect(output).toContain('@throws {TypeError} If the input is empty.');
    });

    it('appends terminal punctuation to @throws description', () => {
      const output = fixCode(`
/**
 * Asserts non-empty.
 *
 * @param x - The value.
 * @returns The value.
 * @throws {TypeError} If the input is empty
 */
function foo(x: string): string { return x; }
`);
      expect(output).toContain('@throws {TypeError} If the input is empty.');
    });

    it('reorders tags into canonical bucket order', () => {
      const output = fixCode(`
/**
 * Adds one.
 *
 * @param x - The value.
 * @throws {Error} On error.
 * @returns The result.
 */
function foo(x: number): number { return x + 1; }
`);
      const paramIdx = output.indexOf('@param');
      const returnsIdx = output.indexOf('@returns');
      const throwsIdx = output.indexOf('@throws');
      expect(paramIdx).toBeLessThan(returnsIdx);
      expect(returnsIdx).toBeLessThan(throwsIdx);
    });

    it('wraps an unfenced @example body in a ```ts fence', () => {
      const output = fixCode(`
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
      expect(output).toContain('@example');
      expect(output).toMatch(/\* ```ts\n \* foo\(1\)\n \* ```/);
    });

    it('converts a single-line JSDoc to multi-line when the function has parameters', () => {
      const output = fixCode(`/** Adds one. */
function foo(x: number): number { return x + 1; }
`);
      expect(output).toContain('/**\n');
      expect(output).toContain(' * Adds one.');
      expect(output).toMatch(/\*\/\nfunction foo/);
    });

    it('leaves a canonical JSDoc untouched', () => {
      const input = `
/**
 * Reduces an array of booleans with the logical AND operation.
 *
 * @param array - Array of boolean values to reduce.
 * @param emptyArrayValue - Value to return if the array is empty.
 * @returns The result of ANDing all boolean values in the array.
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
`;
      expect(fixCode(input)).toBe(input);
    });

    it('does not autofix @throws missing {ErrorType} braces', () => {
      const input = `
/**
 * Asserts non-empty.
 *
 * @param x - The value.
 * @returns The value.
 * @throws If the input is empty.
 */
function foo(x: string): string { return x; }
`;
      const output = fixCode(input);
      expect(output).toContain('@throws If the input is empty.');
      expect(output).not.toContain('@throws {');
    });

    it('does not autofix descriptionTypeRestating phrasing', () => {
      const input = `
/**
 * Builds entries.
 *
 * @param n - Count.
 * @returns An array of entries.
 */
function foo(n: number): number[] { return []; }
`;
      const output = fixCode(input);
      expect(output).toContain('@returns An array of entries.');
    });

    it('fixes a fully non-canonical JSDoc end-to-end', () => {
      const output = fixCode(`
/**
 * adds two numbers
 *
 * @param b the second value
 * @param a - the first value
 * @returns - the result
 */
function foo(a: number, b: number): number { return a + b; }
`);
      expect(output).toContain(' * Adds two numbers.');
      expect(output).toMatch(/@param a - The first value\.\s+\* @param b - The second value\./);
      expect(output).toContain('@returns The result.');
    });
  });
});
