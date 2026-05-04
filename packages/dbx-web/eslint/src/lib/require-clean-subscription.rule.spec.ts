import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { dbxWebEslintPlugin } from './plugin';

const RULE_ID = 'dereekb-dbx-web/require-clean-subscription';

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

describe('require-clean-subscription rule', () => {
  describe('should pass', () => {
    it('cleanSubscription() in @Component class', () => {
      const errors = lintCode(`
        import { Component } from '@angular/core';
        import { cleanSubscription } from '@dereekb/dbx-core';

        @Component({})
        export class GoodComponent {
          readonly sub = cleanSubscription();
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('clean(new SubscriptionObject()) wrapper in @Directive class', () => {
      const errors = lintCode(`
        import { Directive } from '@angular/core';
        import { clean } from '@dereekb/dbx-core';
        import { SubscriptionObject } from '@dereekb/rxjs';

        @Directive({})
        export class GoodDirective {
          readonly sub = clean(new SubscriptionObject());
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('new SubscriptionObject() in plain service is not flagged', () => {
      const errors = lintCode(`
        import { SubscriptionObject } from '@dereekb/rxjs';

        export class PlainService {
          readonly sub = new SubscriptionObject();
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('new SubscriptionObject() in @Injectable is not flagged', () => {
      const errors = lintCode(`
        import { Injectable } from '@angular/core';
        import { SubscriptionObject } from '@dereekb/rxjs';

        @Injectable()
        export class SomeService {
          readonly sub = new SubscriptionObject();
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('SubscriptionObject from a non-@dereekb/rxjs source is not flagged', () => {
      const errors = lintCode(`
        import { Component } from '@angular/core';
        import { SubscriptionObject } from 'other-lib';

        @Component({})
        export class C {
          readonly sub = new SubscriptionObject();
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('static field is not flagged', () => {
      const errors = lintCode(`
        import { Component } from '@angular/core';
        import { SubscriptionObject } from '@dereekb/rxjs';

        @Component({})
        export class C {
          static readonly sub = new SubscriptionObject();
        }
      `);

      expect(errors).toHaveLength(0);
    });
  });

  describe('should fail', () => {
    it('new SubscriptionObject() in @Component', () => {
      const errors = lintCode(`
        import { Component } from '@angular/core';
        import { SubscriptionObject } from '@dereekb/rxjs';

        @Component({})
        export class BadComponent {
          readonly sub = new SubscriptionObject();
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingCleanSubscription');
    });

    it('new SubscriptionObject(existing) in @Directive', () => {
      const errors = lintCode(`
        import { Directive } from '@angular/core';
        import { SubscriptionObject } from '@dereekb/rxjs';

        @Directive({})
        export class BadDirective {
          readonly sub = new SubscriptionObject(existingSub);
        }
      `);

      expect(errors).toHaveLength(1);
    });

    it('new SubscriptionObject() in @Pipe', () => {
      const errors = lintCode(`
        import { Pipe } from '@angular/core';
        import { SubscriptionObject } from '@dereekb/rxjs';

        @Pipe({ name: 'foo' })
        export class BadPipe {
          readonly sub = new SubscriptionObject();
        }
      `);

      expect(errors).toHaveLength(1);
    });
  });

  describe('auto-fix', () => {
    it('rewrites no-arg new SubscriptionObject() to cleanSubscription() and adds import', () => {
      const input = `
import { Component } from '@angular/core';
import { SubscriptionObject } from '@dereekb/rxjs';

@Component({})
export class BadComponent {
  readonly sub = new SubscriptionObject();
}`;

      const output = fixCode(input);
      expect(output).toContain('readonly sub = cleanSubscription();');
      expect(output).toContain("import { cleanSubscription } from '@dereekb/dbx-core';");
    });

    it('preserves an existing constructor argument', () => {
      const input = `
import { Component } from '@angular/core';
import { SubscriptionObject } from '@dereekb/rxjs';

@Component({})
export class BadComponent {
  readonly sub = new SubscriptionObject(existing);
}`;

      const output = fixCode(input);
      expect(output).toContain('readonly sub = cleanSubscription(existing);');
    });

    it('extends an existing @dereekb/dbx-core import without duplication', () => {
      const input = `
import { Component } from '@angular/core';
import { clean } from '@dereekb/dbx-core';
import { SubscriptionObject } from '@dereekb/rxjs';

@Component({})
export class BadComponent {
  readonly sub = new SubscriptionObject();
}`;

      const output = fixCode(input);
      expect(output).toContain("import { clean, cleanSubscription } from '@dereekb/dbx-core';");
      expect(output).not.toContain('cleanSubscription, cleanSubscription');
    });

    it('removes matching this.<field>.destroy() from ngOnDestroy', () => {
      const input = `
import { Component, type OnDestroy } from '@angular/core';
import { SubscriptionObject } from '@dereekb/rxjs';

@Component({})
export class BadComponent implements OnDestroy {
  readonly sub = new SubscriptionObject();

  ngOnDestroy(): void {
    this.sub.destroy();
  }
}`;

      const output = fixCode(input);
      expect(output).toContain('readonly sub = cleanSubscription();');
      expect(output).not.toContain('this.sub.destroy()');
    });

    it('fixes multiple offending fields in a single pass', () => {
      const input = `
import { Component } from '@angular/core';
import { SubscriptionObject } from '@dereekb/rxjs';

@Component({})
export class BadComponent {
  readonly subA = new SubscriptionObject();
  readonly subB = new SubscriptionObject();
}`;

      const output = fixCode(input);
      expect(output).toContain('readonly subA = cleanSubscription();');
      expect(output).toContain('readonly subB = cleanSubscription();');
      const importMatches = output.match(/import \{ cleanSubscription \} from '@dereekb\/dbx-core';/g) ?? [];
      expect(importMatches).toHaveLength(1);
    });
  });
});
