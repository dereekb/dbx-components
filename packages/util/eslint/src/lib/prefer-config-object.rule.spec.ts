import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { utilEslintPlugin } from './plugin';

interface LintOptions {
  readonly maxParams?: number;
  readonly allowJsdocTag?: string;
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
        'dereekb-util/prefer-config-object': ruleOptions as any
      }
    }
  ];
}

function lintCode(code: string, options?: LintOptions): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(options), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/prefer-config-object');
}

describe('prefer-config-object rule', () => {
  describe('valid', () => {
    it('function with two parameters passes', () => {
      const errors = lintCode(`
function add(a: number, b: number) {
  return a + b;
}
`);
      expect(errors).toHaveLength(0);
    });

    it('function with zero parameters passes', () => {
      const errors = lintCode(`
function ping() {
  return 'pong';
}
`);
      expect(errors).toHaveLength(0);
    });

    it('function with one param + rest does not flag the rest as additional positional', () => {
      const errors = lintCode(`
function variadic(first: string, ...rest: number[]) {
  return rest.length;
}
`);
      // 2 params total in node.params — passes the default cap of 2.
      expect(errors).toHaveLength(0);
    });

    it('constructor is exempt', () => {
      const errors = lintCode(`
class Service {
  constructor(a: string, b: number, c: boolean, d: Date) {}
}
`);
      expect(errors).toHaveLength(0);
    });

    it('decorated parameters are exempt (NestJS handler signatures)', () => {
      const errors = lintCode(`
class Controller {
  handler(@Body() body: any, @Param() param: any, @Query() query: any) {
    return body;
  }
}
`);
      expect(errors).toHaveLength(0);
    });

    it('@dbxAllowMultiParams JSDoc opts out', () => {
      const errors = lintCode(`
/**
 * @dbxAllowMultiParams
 */
export function legacy(a: string, b: string, c: string, d: string) {
  return a + b + c + d;
}
`);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid', () => {
    it('flags a function with three parameters', () => {
      const errors = lintCode(`
function createFilter(name: string, caseSensitive: boolean, maxResults: number) {
  return { name, caseSensitive, maxResults };
}
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('createFilter');
      expect(errors[0].message).toContain('3 positional');
    });

    it('flags an arrow function with four parameters', () => {
      const errors = lintCode(`
const make = (a: string, b: string, c: string, d: string) => a + b + c + d;
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('make');
    });

    it('flags class methods (non-constructor) with too many params', () => {
      const errors = lintCode(`
class Foo {
  process(a: number, b: number, c: number) {
    return a + b + c;
  }
}
`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('process');
    });

    it('honors maxParams option', () => {
      const errors = lintCode(
        `
function tri(a: number, b: number, c: number) {
  return a + b + c;
}
`,
        { maxParams: 4 }
      );
      expect(errors).toHaveLength(0);
    });

    it('honors maxParams: 1', () => {
      const errors = lintCode(
        `
function pair(a: number, b: number) {
  return a + b;
}
`,
        { maxParams: 1 }
      );
      expect(errors).toHaveLength(1);
    });

    it('honors custom allowJsdocTag', () => {
      const errors = lintCode(
        `
/**
 * @internal-allow
 */
function legacy(a: string, b: string, c: string, d: string) {
  return a + b + c + d;
}
`,
        { allowJsdocTag: '@internal-allow' }
      );
      expect(errors).toHaveLength(0);
    });
  });
});
