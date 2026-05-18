import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { utilEslintPlugin } from './plugin';

const RULE_ID = 'dereekb-util/require-exported-jsdoc-example';

function makeConfig(): Linter.Config[] {
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
        [RULE_ID]: 'error'
      }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, makeConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

describe('require-exported-jsdoc-example rule', () => {
  describe('valid', () => {
    it('exported function with @example passes', () => {
      const errors = lintCode(`
/**
 * Adds two numbers.
 *
 * @example
 * \`\`\`ts
 * add(1, 2); // 3
 * \`\`\`
 */
export function add(a: number, b: number): number {
  return a + b;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('exported function with @dbxAllowSkipExample passes', () => {
      const errors = lintCode(`
/**
 * Adds two numbers.
 *
 * @dbxAllowSkipExample
 */
export function add(a: number, b: number): number {
  return a + b;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('exported function without JSDoc is not flagged (require-jsdoc handles that)', () => {
      const errors = lintCode(`export function add(a: number, b: number): number { return a + b; }`);
      expect(errors).toHaveLength(0);
    });

    it('non-exported function is not flagged', () => {
      const errors = lintCode(`
/**
 * Adds two numbers.
 */
function add(a: number, b: number): number {
  return a + b;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('zero-arg exported function is exempted by default', () => {
      const errors = lintCode(`
/**
 * Returns a fresh seed.
 */
export function seed(): number {
  return 0;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('export default function with @example passes', () => {
      const errors = lintCode(`
/**
 * Default thing.
 *
 * @example
 * \`\`\`ts
 * defaultFn(1);
 * \`\`\`
 */
export default function defaultFn(a: number): number {
  return a;
}
`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid', () => {
    it('exported function with JSDoc but no @example is flagged', () => {
      const errors = lintCode(`
/**
 * Adds two numbers.
 */
export function add(a: number, b: number): number {
  return a + b;
}
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingExample');
    });

    it('export default function with JSDoc but no @example is flagged', () => {
      const errors = lintCode(`
/**
 * Default thing.
 */
export default function defaultFn(a: number): number {
  return a;
}
`);
      expect(errors).toHaveLength(1);
    });
  });

  describe('options', () => {
    it('custom exempt tag is honored', () => {
      const linter = new Linter({ configType: 'flat' });
      const config: Linter.Config[] = [
        {
          files: ['**/*.ts'],
          languageOptions: {
            parser: tsParser as any,
            parserOptions: { ecmaVersion: 2022, sourceType: 'module' }
          },
          plugins: { 'dereekb-util': utilEslintPlugin as any },
          rules: { [RULE_ID]: ['error', { exemptJsdocTag: '@mySkipTag' }] }
        }
      ];

      const code = `
/**
 * Adds.
 *
 * @mySkipTag
 */
export function add(a: number, b: number): number {
  return a + b;
}
`;
      const errors = linter.verify(code, config, { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
      expect(errors).toHaveLength(0);
    });

    it('exemptNoArguments: false flags zero-arg functions', () => {
      const linter = new Linter({ configType: 'flat' });
      const config: Linter.Config[] = [
        {
          files: ['**/*.ts'],
          languageOptions: {
            parser: tsParser as any,
            parserOptions: { ecmaVersion: 2022, sourceType: 'module' }
          },
          plugins: { 'dereekb-util': utilEslintPlugin as any },
          rules: { [RULE_ID]: ['error', { exemptNoArguments: false }] }
        }
      ];

      const code = `
/**
 * Returns the seed.
 */
export function seed(): number {
  return 0;
}
`;
      const errors = linter.verify(code, config, { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
      expect(errors).toHaveLength(1);
    });
  });
});
