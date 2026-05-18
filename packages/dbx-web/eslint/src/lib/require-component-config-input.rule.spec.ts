import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { dbxWebEslintPlugin } from './plugin';

const RULE_ID = 'dereekb-dbx-web/require-component-config-input';

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
        'dereekb-dbx-web': dbxWebEslintPlugin as any
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

describe('require-component-config-input rule', () => {
  describe('should pass', () => {
    it('@Component with 3 input() properties (at the threshold, not over)', () => {
      const errors = lintCode(`
        import { Component, input } from '@angular/core';

        @Component({})
        export class GoodComponent {
          readonly a = input<string>();
          readonly b = input<number>();
          readonly c = input<boolean>();
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('@Component with 0 inputs', () => {
      const errors = lintCode(`
        import { Component } from '@angular/core';

        @Component({})
        export class EmptyComponent {}
      `);

      expect(errors).toHaveLength(0);
    });

    it('plain (non-decorated) class with 5 inputs is not flagged', () => {
      const errors = lintCode(`
        import { input } from '@angular/core';

        export class PlainService {
          readonly a = input<string>();
          readonly b = input<string>();
          readonly c = input<string>();
          readonly d = input<string>();
          readonly e = input<string>();
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('@Component with 5 input() properties imported from a non-@angular/core module is not flagged', () => {
      const errors = lintCode(`
        import { Component } from '@angular/core';
        import { input } from 'other-lib';

        @Component({})
        export class FineComponent {
          readonly a = input<string>();
          readonly b = input<string>();
          readonly c = input<string>();
          readonly d = input<string>();
          readonly e = input<string>();
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('static input() is not counted', () => {
      const errors = lintCode(`
        import { Component, input } from '@angular/core';

        @Component({})
        export class FineComponent {
          static readonly fallback = input<string>();
          readonly a = input<string>();
          readonly b = input<string>();
          readonly c = input<string>();
        }
      `);

      expect(errors).toHaveLength(0);
    });
  });

  describe('should fail', () => {
    it('@Component with 4 input() properties (one over the threshold)', () => {
      const errors = lintCode(`
        import { Component, input } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly a = input<string>();
          readonly b = input<string>();
          readonly c = input<string>();
          readonly d = input<string>();
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('tooManySignalInputs');
    });

    it('@Directive with 6 input() properties', () => {
      const errors = lintCode(`
        import { Directive, input } from '@angular/core';

        @Directive({})
        export class BadDirective {
          readonly a = input<string>();
          readonly b = input<string>();
          readonly c = input<string>();
          readonly d = input<string>();
          readonly e = input<string>();
          readonly f = input<string>();
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('tooManySignalInputs');
    });

    it('@Component with 4 input.required() properties', () => {
      const errors = lintCode(`
        import { Component, input } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly a = input.required<string>();
          readonly b = input.required<string>();
          readonly c = input.required<string>();
          readonly d = input.required<string>();
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('tooManySignalInputs');
    });

    it('@Component with a mix of input() and input.required() summing to 4', () => {
      const errors = lintCode(`
        import { Component, input } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly a = input<string>();
          readonly b = input<string>();
          readonly c = input.required<string>();
          readonly d = input.required<string>();
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('tooManySignalInputs');
    });
  });
});
