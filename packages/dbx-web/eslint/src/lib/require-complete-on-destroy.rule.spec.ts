import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { dbxWebEslintPlugin } from './plugin';

const RULE_ID = 'dereekb-dbx-web/require-complete-on-destroy';

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

function fixCode(code: string): string {
  const linter = new Linter({ configType: 'flat' });
  const result = linter.verifyAndFix(code, makeConfig(), { filename: 'test.ts' });
  return result.output;
}

describe('require-complete-on-destroy rule', () => {
  describe('should pass', () => {
    it('completeOnDestroy(new BehaviorSubject(x)) in @Component', () => {
      const errors = lintCode(`
        import { Component } from '@angular/core';
        import { completeOnDestroy } from '@dereekb/dbx-core';
        import { BehaviorSubject } from 'rxjs';

        @Component({})
        export class GoodComponent {
          readonly data = completeOnDestroy(new BehaviorSubject<number>(0));
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('new BehaviorSubject() in @Injectable is not flagged', () => {
      const errors = lintCode(`
        import { Injectable } from '@angular/core';
        import { BehaviorSubject } from 'rxjs';

        @Injectable()
        export class SomeService {
          readonly data = new BehaviorSubject<number>(0);
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('Subject from a non-rxjs source is not flagged', () => {
      const errors = lintCode(`
        import { Component } from '@angular/core';
        import { BehaviorSubject } from 'other-lib';

        @Component({})
        export class C {
          readonly data = new BehaviorSubject<number>(0);
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('static field is not flagged', () => {
      const errors = lintCode(`
        import { Component } from '@angular/core';
        import { Subject } from 'rxjs';

        @Component({})
        export class C {
          static readonly s = new Subject<void>();
        }
      `);

      expect(errors).toHaveLength(0);
    });
  });

  describe('should fail', () => {
    it('new Subject<void>() in @Component', () => {
      const errors = lintCode(`
        import { Component } from '@angular/core';
        import { Subject } from 'rxjs';

        @Component({})
        export class BadComponent {
          readonly s = new Subject<void>();
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingCompleteOnDestroy');
      expect(errors[0].message).toContain('Subject');
    });

    it('new BehaviorSubject<X[]>([]) in @Directive', () => {
      const errors = lintCode(`
        import { Directive } from '@angular/core';
        import { BehaviorSubject } from 'rxjs';

        @Directive({})
        export class BadDirective {
          readonly items = new BehaviorSubject<string[]>([]);
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('BehaviorSubject');
    });

    it('new ReplaySubject(1) in @Pipe', () => {
      const errors = lintCode(`
        import { Pipe } from '@angular/core';
        import { ReplaySubject } from 'rxjs';

        @Pipe({ name: 'foo' })
        export class BadPipe {
          readonly s = new ReplaySubject<number>(1);
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('ReplaySubject');
    });

    it('new AsyncSubject() in @Component', () => {
      const errors = lintCode(`
        import { Component } from '@angular/core';
        import { AsyncSubject } from 'rxjs';

        @Component({})
        export class BadComponent {
          readonly s = new AsyncSubject<number>();
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('AsyncSubject');
    });
  });

  describe('auto-fix', () => {
    it('wraps new BehaviorSubject(x) with completeOnDestroy and adds import', () => {
      const input = `
import { Component } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Component({})
export class BadComponent {
  readonly data = new BehaviorSubject<number>(0);
}`;

      const output = fixCode(input);
      expect(output).toContain('readonly data = completeOnDestroy(new BehaviorSubject<number>(0));');
      expect(output).toContain("import { completeOnDestroy } from '@dereekb/dbx-core';");
    });

    it('extends an existing @dereekb/dbx-core import without duplication', () => {
      const input = `
import { Component } from '@angular/core';
import { clean } from '@dereekb/dbx-core';
import { Subject } from 'rxjs';

@Component({})
export class BadComponent {
  readonly s = new Subject<void>();
}`;

      const output = fixCode(input);
      expect(output).toContain("import { clean, completeOnDestroy } from '@dereekb/dbx-core';");
    });

    it('removes matching this.<field>.complete() from ngOnDestroy', () => {
      const input = `
import { Component, type OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Component({})
export class BadComponent implements OnDestroy {
  readonly data = new BehaviorSubject<number>(0);

  ngOnDestroy(): void {
    this.data.complete();
  }
}`;

      const output = fixCode(input);
      expect(output).toContain('readonly data = completeOnDestroy(new BehaviorSubject<number>(0));');
      expect(output).not.toContain('this.data.complete()');
    });
  });
});
