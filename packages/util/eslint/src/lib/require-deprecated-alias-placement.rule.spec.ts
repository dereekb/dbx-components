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
        'dereekb-util/require-deprecated-alias-placement': 'error'
      }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-deprecated-alias-placement');
}

describe('require-deprecated-alias-placement rule', () => {
  describe('valid', () => {
    it('file with no deprecated exports passes', () => {
      const errors = lintCode(`
export const NEW_NAME = 'foo';
export const OTHER = 'bar';
`);
      expect(errors).toHaveLength(0);
    });

    it('file with deprecated exports correctly placed below the marker passes', () => {
      const errors = lintCode(`
export const NEW_NAME = 'foo';

// COMPAT: Deprecated aliases
/**
 * @deprecated use NEW_NAME instead.
 */
export const oldName = NEW_NAME;
`);
      expect(errors).toHaveLength(0);
    });

    it('two deprecated aliases stacked under the marker pass', () => {
      const errors = lintCode(`
export const A = 1;
export const B = 2;

// COMPAT: Deprecated aliases
/**
 * @deprecated use A instead.
 */
export const oldA = A;
/**
 * @deprecated use B instead.
 */
export const oldB = B;
`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid', () => {
    it('flags missing marker when a @deprecated export is present', () => {
      const errors = lintCode(`
/**
 * @deprecated use NEW_NAME instead.
 */
export const oldName = 'foo';
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingCompatMarker');
    });

    it('flags a @deprecated export sitting above the marker', () => {
      const errors = lintCode(`
/**
 * @deprecated use NEW_NAME instead.
 */
export const oldName = 'foo';

export const NEW_NAME = 'foo';

// COMPAT: Deprecated aliases
/**
 * @deprecated also deprecated.
 */
export const anotherOld = 'bar';
`);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors.some((e) => e.messageId === 'deprecatedAliasNotAtBottom')).toBe(true);
    });

    it('flags a non-deprecated export sitting below the marker', () => {
      const errors = lintCode(`
export const NEW_NAME = 'foo';

// COMPAT: Deprecated aliases
export const OUT_OF_PLACE = 'oops';
/**
 * @deprecated use NEW_NAME instead.
 */
export const oldName = NEW_NAME;
`);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors.some((e) => e.messageId === 'nonDeprecatedAfterMarker')).toBe(true);
    });
  });
});
