import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { DBX_WEB_ESLINT_PLUGIN } from './plugin';

const RULE_ID = 'dereekb-dbx-web/require-computed-signal-suffix';

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
        'dereekb-dbx-web': DBX_WEB_ESLINT_PLUGIN
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

describe('require-computed-signal-suffix rule', () => {
  describe('should pass', () => {
    it('computed property ending with Signal in @Component', () => {
      const errors = lintCode(`
        import { Component, computed, input } from '@angular/core';

        @Component({})
        export class GoodComponent {
          readonly step = input<number>();
          readonly stepSignal = computed(() => this.step() ?? 1);
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('input property without Signal suffix in @Directive', () => {
      const errors = lintCode(`
        import { Directive, input } from '@angular/core';

        @Directive({})
        export class GoodDirective {
          readonly color = input<string>();
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('input.required() property without Signal suffix', () => {
      const errors = lintCode(`
        import { Component, input } from '@angular/core';

        @Component({})
        export class GoodComponent {
          readonly id = input.required<string>();
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('model property without Signal suffix', () => {
      const errors = lintCode(`
        import { Component, model } from '@angular/core';

        @Component({})
        export class GoodComponent {
          readonly value = model<string>('');
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('computed property in a plain service class is not flagged', () => {
      const errors = lintCode(`
        import { computed, signal } from '@angular/core';

        export class PlainService {
          readonly count = signal(0);
          readonly doubled = computed(() => this.count() * 2);
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('computed from a non-@angular/core source is not flagged', () => {
      const errors = lintCode(`
        import { Component } from '@angular/core';
        import { computed } from 'other-lib';

        @Component({})
        export class FineComponent {
          readonly total = computed(() => 1);
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('static property initialized with computed() is ignored', () => {
      const errors = lintCode(`
        import { Component, computed } from '@angular/core';

        @Component({})
        export class FineComponent {
          static readonly fallback = computed(() => 1);
        }
      `);

      expect(errors).toHaveLength(0);
    });
  });

  describe('should fail', () => {
    it('computed property without Signal suffix in @Component', () => {
      const errors = lintCode(`
        import { Component, computed, input } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly step = input<number>();
          readonly resolved = computed(() => this.step() ?? 1);
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingSignalSuffix');
    });

    it('input property with Signal suffix in @Directive', () => {
      const errors = lintCode(`
        import { Directive, input } from '@angular/core';

        @Directive({})
        export class BadDirective {
          readonly colorSignal = input<string>();
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('signalSuffixOnInput');
    });

    it('input.required property with Signal suffix', () => {
      const errors = lintCode(`
        import { Component, input } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly idSignal = input.required<string>();
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('signalSuffixOnInput');
    });

    it('model property with Signal suffix', () => {
      const errors = lintCode(`
        import { Component, model } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly valueSignal = model<string>('');
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('signalSuffixOnInput');
    });

    it('fires on @Pipe classes too', () => {
      const errors = lintCode(`
        import { Pipe, computed } from '@angular/core';

        @Pipe({ name: 'foo' })
        export class BadPipe {
          readonly resolved = computed(() => 1);
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingSignalSuffix');
    });

    it('property literally named "Signal" is allowed (suffix-only is degenerate)', () => {
      const errors = lintCode(`
        import { Component, input } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly Signal = input<string>();
        }
      `);

      expect(errors).toHaveLength(0);
    });
  });
});
