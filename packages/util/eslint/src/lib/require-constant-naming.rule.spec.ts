import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { UTIL_ESLINT_PLUGIN } from './plugin';

const RULE_ID = 'dereekb-util/require-constant-naming';

function makeConfig(): Linter.Config[] {
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
        [RULE_ID]: 'error'
      }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, makeConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

describe('require-constant-naming rule', () => {
  describe('value constants', () => {
    it('UPPER_SNAKE_CASE string literal passes', () => {
      const errors = lintCode(`export const COMMA_JOINER = ',';`);
      expect(errors).toHaveLength(0);
    });

    it('UPPER_SNAKE_CASE number literal passes', () => {
      const errors = lintCode(`export const DEFAULT_PAGE_SIZE = 25;`);
      expect(errors).toHaveLength(0);
    });

    it('PascalCase value constant passes (class/enum-like exception)', () => {
      const errors = lintCode(`export const MyEnum = { A: 1, B: 2 } as const;`);
      expect(errors).toHaveLength(0);
    });

    it('camelCase string literal is flagged', () => {
      const errors = lintCode(`export const commaJoiner = ',';`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('valueConstantShouldBeUpperSnakeCase');
    });

    it('camelCase object literal is flagged', () => {
      const errors = lintCode(`export const defaultColors = { primary: 'red' };`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('valueConstantShouldBeUpperSnakeCase');
    });

    it('snake_case array literal is flagged', () => {
      const errors = lintCode(`export const default_items = ['a'];`);
      expect(errors).toHaveLength(1);
    });

    it('camelCase NewExpression literal is flagged', () => {
      const errors = lintCode(`export const myRegistry = new Map();`);
      expect(errors).toHaveLength(1);
    });
  });

  describe('function constants', () => {
    it('camelCase arrow function passes', () => {
      const errors = lintCode(`export const makeThing = () => 1;`);
      expect(errors).toHaveLength(0);
    });

    it('camelCase function expression passes', () => {
      const errors = lintCode(`export const isThing = function (x: unknown) { return !!x; };`);
      expect(errors).toHaveLength(0);
    });

    it('camelCase TSFunctionType annotation passes', () => {
      const errors = lintCode(`
        type Fn = (a: number) => number;
        export const myFn: Fn = (a) => a + 1;
      `);
      expect(errors).toHaveLength(0);
    });

    it('camelCase inline TSFunctionType annotation passes', () => {
      const errors = lintCode(`export const myFn: (a: number) => number = (a) => a + 1;`);
      expect(errors).toHaveLength(0);
    });

    it('UPPER_SNAKE_CASE arrow function passes', () => {
      const errors = lintCode(`export const MAKE_THING = () => 1;`);
      expect(errors).toHaveLength(0);
    });

    it('UPPER_SNAKE_CASE function expression passes', () => {
      const errors = lintCode(`export const IS_THING = function (x: unknown) { return !!x; };`);
      expect(errors).toHaveLength(0);
    });

    it('UPPER_SNAKE_CASE TSFunctionType annotation passes', () => {
      const errors = lintCode(`
        type Fn = (a: number) => number;
        export const MY_FN: Fn = (a) => a + 1;
      `);
      expect(errors).toHaveLength(0);
    });

    it('snake_case arrow function is flagged', () => {
      const errors = lintCode(`export const make_thing = () => 1;`);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('functionConstantShouldBeCamelCase');
    });
  });

  describe('ambiguous initializers', () => {
    it('CallExpression initializer is not flagged regardless of case', () => {
      const errors = lintCode(`export const myFactory = makeFactory();`);
      expect(errors).toHaveLength(0);
    });

    it('Identifier alias is not flagged', () => {
      const errors = lintCode(`
        const inner = 1;
        export const someAlias = inner;
      `);
      expect(errors).toHaveLength(0);
    });

    it('MemberExpression alias is not flagged', () => {
      const errors = lintCode(`
        const ns = { inner: 1 };
        export const someAlias = ns.inner;
      `);
      expect(errors).toHaveLength(0);
    });
  });

  describe('exemptions', () => {
    it('@dbxAllowConstantName JSDoc skips the rule', () => {
      const errors = lintCode(`
        /**
         * @dbxAllowConstantName
         */
        export const mixedName = 'whatever';
      `);
      expect(errors).toHaveLength(0);
    });

    it('non-exported const is not checked', () => {
      const errors = lintCode(`const lowerSnakeCaseLocal = 'x';`);
      expect(errors).toHaveLength(0);
    });

    it('underscore-prefixed exports are skipped', () => {
      const errors = lintCode(`export const _internalCache = new Map();`);
      expect(errors).toHaveLength(0);
    });

    it('let/var declarations are not checked', () => {
      const errors = lintCode(`export let mutableThing = 'x';`);
      expect(errors).toHaveLength(0);
    });
  });
});
