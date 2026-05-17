import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { utilEslintPlugin } from './plugin';

interface LintOptions {
  readonly additionalSuffixes?: readonly string[];
  readonly exemptJsdocTag?: string;
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
        'dereekb-util/require-readonly-config-params': ruleOptions as any
      }
    }
  ];
}

function lintCode(code: string, options?: LintOptions): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(options), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-readonly-config-params');
}

function fixCode(code: string, options?: LintOptions): string {
  const linter = new Linter({ configType: 'flat' });
  const result = linter.verifyAndFix(code, buildConfig(options), { filename: 'test.ts' });
  return result.output;
}

describe('require-readonly-config-params rule', () => {
  describe('valid', () => {
    it('Config interface with all readonly properties passes', () => {
      const errors = lintCode(`
interface MyConfig {
  readonly name: string;
  readonly count?: number;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('Params interface with all readonly properties passes', () => {
      const errors = lintCode(`
interface MyParams {
  readonly id: string;
  readonly active: boolean;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('interfaces without Config/Params suffix are ignored', () => {
      const errors = lintCode(`
interface FirestoreModel {
  name: string;
  count: number;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('@dbxMutable JSDoc exempts the interface', () => {
      const errors = lintCode(`
/**
 * @dbxMutable
 */
interface ModelConfig {
  name: string;
  count: number;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('@dbxMutable JSDoc on exported interface exempts it too', () => {
      const errors = lintCode(`
/**
 * @dbxMutable
 */
export interface ModelConfig {
  name: string;
  count: number;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('method signatures inside the interface are ignored (not property signatures)', () => {
      const errors = lintCode(`
interface MyConfig {
  readonly name: string;
  build(): void;
}
`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid', () => {
    it('flags a Config interface with a non-readonly property', () => {
      const errors = lintCode(`
interface MyConfig {
  name: string;
}
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('name');
      expect(errors[0].message).toContain('MyConfig');
    });

    it('flags each non-readonly property on a Params interface', () => {
      const errors = lintCode(`
interface MyParams {
  id: string;
  active: boolean;
  readonly skipped: string;
}
`);
      expect(errors).toHaveLength(2);
    });

    it('flags optional non-readonly properties', () => {
      const errors = lintCode(`
interface MyConfig {
  readonly name: string;
  count?: number;
}
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('count');
    });

    it('flags non-readonly properties on exported interfaces too', () => {
      const errors = lintCode(`
export interface MyConfig {
  name: string;
}
`);
      expect(errors).toHaveLength(1);
    });

    it('honors additionalSuffixes option for Options-suffixed interfaces', () => {
      const errors = lintCode(
        `
interface MyOptions {
  name: string;
}
`,
        { additionalSuffixes: ['Options'] }
      );
      expect(errors).toHaveLength(1);
    });

    it('honors custom exemptJsdocTag', () => {
      const errors = lintCode(
        `
/**
 * @firestoreModel
 */
interface UserConfig {
  name: string;
}
`,
        { exemptJsdocTag: '@firestoreModel' }
      );
      expect(errors).toHaveLength(0);
    });
  });

  describe('auto-fix', () => {
    it('inserts readonly before each non-readonly property', () => {
      const input = `
interface MyConfig {
  name: string;
  count?: number;
}
`;
      const output = fixCode(input);
      expect(output).toContain('readonly name: string');
      expect(output).toContain('readonly count?: number');
    });

    it('preserves already-readonly properties', () => {
      const input = `
interface MyConfig {
  readonly id: string;
  name: string;
}
`;
      const output = fixCode(input);
      // Single occurrence of `readonly id`, single of `readonly name`.
      expect((output.match(/readonly id/g) ?? []).length).toBe(1);
      expect((output.match(/readonly name/g) ?? []).length).toBe(1);
    });
  });
});
