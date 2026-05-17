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

function fixCode(code: string): string {
  const linter = new Linter({ configType: 'flat' });
  const result = linter.verifyAndFix(code, buildConfig(), { filename: 'test.ts' });
  return result.output;
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

    it('deprecated overload signature kept adjacent to its implementation passes', () => {
      const errors = lintCode(`
export function foo(a: number): string;
/**
 * @deprecated use the object form.
 */
export function foo(a: number, b: number): string;
export function foo(a: number, b?: number): string {
  return String(a) + (b ?? '');
}
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

  describe('autofix', () => {
    it('inserts the marker before the first deprecated export when all deprecated are at the bottom', () => {
      const input = `export const NEW_NAME = 'foo';

/**
 * @deprecated use NEW_NAME instead.
 */
export const oldName = NEW_NAME;
`;
      const output = fixCode(input);
      expect(output).toContain('// COMPAT: Deprecated aliases');
      // Marker should appear before the deprecated JSDoc, not after the deprecated statement.
      const markerIdx = output.indexOf('// COMPAT: Deprecated aliases');
      const jsdocIdx = output.indexOf('/**\n * @deprecated');
      expect(markerIdx).toBeGreaterThan(0);
      expect(markerIdx).toBeLessThan(jsdocIdx);
      // No remaining warnings after the fix.
      expect(lintCode(output)).toHaveLength(0);
    });

    it('inserts the marker when the file contains only deprecated exports', () => {
      const input = `/**
 * @deprecated use newOne instead.
 */
export const oldOne = 'a';

/**
 * @deprecated use newTwo instead.
 */
export const oldTwo = 'b';
`;
      const output = fixCode(input);
      expect(output).toContain('// COMPAT: Deprecated aliases');
      expect(lintCode(output)).toHaveLength(0);
    });

    it('moves interleaved deprecated exports to the bottom under a marker', () => {
      const input = `/**
 * @deprecated use NEW_NAME instead.
 */
export const oldName = 'foo';

export const NEW_NAME = 'foo';
`;
      const output = fixCode(input);
      // Reordering required; the deprecated block should now sit below the marker at EOF.
      const markerIdx = output.indexOf('// COMPAT: Deprecated aliases');
      const newNameIdx = output.indexOf('export const NEW_NAME');
      const oldNameIdx = output.indexOf('export const oldName');
      expect(markerIdx).toBeGreaterThan(0);
      expect(newNameIdx).toBeGreaterThanOrEqual(0);
      expect(newNameIdx).toBeLessThan(markerIdx);
      expect(oldNameIdx).toBeGreaterThan(markerIdx);
      expect(lintCode(output)).toHaveLength(0);
    });

    it('consolidates multiple interleaved deprecated blocks in source order at the bottom', () => {
      const input = `/**
 * @deprecated use A instead.
 */
export const oldA = 'a';

export const A = 'a';

/**
 * @deprecated use B instead.
 */
export const oldB = 'b';

export const B = 'b';
`;
      const output = fixCode(input);
      const markerIdx = output.indexOf('// COMPAT: Deprecated aliases');
      const oldAIdx = output.indexOf('export const oldA');
      const oldBIdx = output.indexOf('export const oldB');
      const aIdx = output.indexOf('export const A =');
      const bIdx = output.indexOf('export const B =');
      // Marker sits below both non-deprecated exports
      expect(aIdx).toBeLessThan(markerIdx);
      expect(bIdx).toBeLessThan(markerIdx);
      // Deprecated blocks sit below the marker, in their original source order
      expect(oldAIdx).toBeGreaterThan(markerIdx);
      expect(oldBIdx).toBeGreaterThan(oldAIdx);
      expect(lintCode(output)).toHaveLength(0);
    });

    it('moves a deprecated alias sitting above the marker to below it', () => {
      const input = `/**
 * @deprecated use NEW_NAME instead.
 */
export const oldName = 'foo';

export const NEW_NAME = 'foo';

// COMPAT: Deprecated aliases
/**
 * @deprecated also deprecated.
 */
export const anotherOld = 'bar';
`;
      const output = fixCode(input);
      const markerIdx = output.indexOf('// COMPAT: Deprecated aliases');
      const oldNameIdx = output.indexOf('export const oldName');
      const newNameIdx = output.indexOf('export const NEW_NAME');
      expect(markerIdx).toBeGreaterThan(0);
      expect(newNameIdx).toBeGreaterThanOrEqual(0);
      expect(newNameIdx).toBeLessThan(markerIdx);
      expect(oldNameIdx).toBeGreaterThan(markerIdx);
      expect(lintCode(output)).toHaveLength(0);
    });

    it('moves a non-deprecated export sitting below the marker to above it', () => {
      const input = `export const NEW_NAME = 'foo';

// COMPAT: Deprecated aliases
export const OUT_OF_PLACE = 'oops';
/**
 * @deprecated use NEW_NAME instead.
 */
export const oldName = NEW_NAME;
`;
      const output = fixCode(input);
      const markerIdx = output.indexOf('// COMPAT: Deprecated aliases');
      const outOfPlaceIdx = output.indexOf('export const OUT_OF_PLACE');
      const oldNameIdx = output.indexOf('export const oldName');
      expect(markerIdx).toBeGreaterThan(0);
      expect(outOfPlaceIdx).toBeGreaterThan(0);
      expect(outOfPlaceIdx).toBeLessThan(markerIdx);
      expect(oldNameIdx).toBeGreaterThan(markerIdx);
      expect(lintCode(output)).toHaveLength(0);
    });
  });
});
