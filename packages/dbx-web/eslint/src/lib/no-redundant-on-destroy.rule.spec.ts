import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { dbxWebEslintPlugin } from './plugin';

const RULE_ID = 'dereekb-dbx-web/no-redundant-on-destroy';

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

describe('no-redundant-on-destroy rule', () => {
  describe('should pass', () => {
    it('ngOnDestroy with non-cleanup logic', () => {
      const errors = lintCode(`
        import { Component, type OnDestroy } from '@angular/core';
        import { cleanSubscription } from '@dereekb/dbx-core';

        @Component({})
        export class C implements OnDestroy {
          readonly sub = cleanSubscription();

          ngOnDestroy(): void {
            console.log('bye');
          }
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('destroy() called on a non-wrapped field is preserved', () => {
      const errors = lintCode(`
        import { Component, type OnDestroy } from '@angular/core';
        import { SubscriptionObject } from '@dereekb/rxjs';

        @Component({})
        export class C implements OnDestroy {
          readonly sub = new SubscriptionObject();

          ngOnDestroy(): void {
            this.sub.destroy();
          }
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('plain service is not flagged', () => {
      const errors = lintCode(`
        import { cleanSubscription } from '@dereekb/dbx-core';

        export class PlainService {
          readonly sub = cleanSubscription();

          ngOnDestroy(): void {
            this.sub.destroy();
          }
        }
      `);

      expect(errors).toHaveLength(0);
    });
  });

  describe('should fail', () => {
    it('ngOnDestroy with only redundant destroy() on cleanSubscription field', () => {
      const errors = lintCode(`
        import { Component, type OnDestroy } from '@angular/core';
        import { cleanSubscription } from '@dereekb/dbx-core';

        @Component({})
        export class C implements OnDestroy {
          readonly sub = cleanSubscription();

          ngOnDestroy(): void {
            this.sub.destroy();
          }
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('redundantNgOnDestroy');
    });

    it('ngOnDestroy with only redundant complete() on completeOnDestroy field', () => {
      const errors = lintCode(`
        import { Component, type OnDestroy } from '@angular/core';
        import { completeOnDestroy } from '@dereekb/dbx-core';
        import { Subject } from 'rxjs';

        @Component({})
        export class C implements OnDestroy {
          readonly s = completeOnDestroy(new Subject<void>());

          ngOnDestroy(): void {
            this.s.complete();
          }
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('redundantNgOnDestroy');
    });

    it('mixed cleanup with non-cleanup statements reports per redundant statement', () => {
      const errors = lintCode(`
        import { Component, type OnDestroy } from '@angular/core';
        import { cleanSubscription, completeOnDestroy } from '@dereekb/dbx-core';
        import { Subject } from 'rxjs';

        @Component({})
        export class C implements OnDestroy {
          readonly sub = cleanSubscription();
          readonly s = completeOnDestroy(new Subject<void>());

          ngOnDestroy(): void {
            console.log('bye');
            this.sub.destroy();
            this.s.complete();
          }
        }
      `);

      expect(errors).toHaveLength(2);
      expect(errors.every((e) => e.messageId === 'redundantCleanupCall')).toBe(true);
    });
  });

  describe('empty body', () => {
    it('reports an empty ngOnDestroy method', () => {
      const errors = lintCode(`
        import { Component, type OnDestroy } from '@angular/core';

        @Component({})
        export class C implements OnDestroy {
          ngOnDestroy(): void {}
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('emptyNgOnDestroy');
    });

    it('removes an empty ngOnDestroy method on auto-fix', () => {
      const input = `
import { Component, type OnDestroy } from '@angular/core';

@Component({})
export class C implements OnDestroy {
  ngOnDestroy(): void {}
}`;

      const output = fixCode(input);
      expect(output).not.toContain('ngOnDestroy');
    });
  });

  describe('auto-fix', () => {
    it('removes the entire ngOnDestroy method when only redundant calls remain', () => {
      const input = `
import { Component, type OnDestroy } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';

@Component({})
export class C implements OnDestroy {
  readonly sub = cleanSubscription();

  ngOnDestroy(): void {
    this.sub.destroy();
  }
}`;

      const output = fixCode(input);
      expect(output).not.toContain('ngOnDestroy');
      expect(output).toContain('readonly sub = cleanSubscription();');
    });

    it('removes only redundant statements when other logic exists', () => {
      const input = `
import { Component, type OnDestroy } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';

@Component({})
export class C implements OnDestroy {
  readonly sub = cleanSubscription();

  ngOnDestroy(): void {
    console.log('bye');
    this.sub.destroy();
  }
}`;

      const output = fixCode(input);
      expect(output).toContain('ngOnDestroy');
      expect(output).toContain("console.log('bye')");
      expect(output).not.toContain('this.sub.destroy()');
    });
  });

  describe('implements OnDestroy cleanup', () => {
    it('removes the sole `implements OnDestroy` clause when removing ngOnDestroy', () => {
      const input = `
import { Component, type OnDestroy } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';

@Component({})
export class C implements OnDestroy {
  readonly sub = cleanSubscription();

  ngOnDestroy(): void {
    this.sub.destroy();
  }
}`;

      const output = fixCode(input);
      expect(output).not.toContain('ngOnDestroy');
      expect(output).not.toContain('implements');
      expect(output).toContain('export class C {');
    });

    it('removes only OnDestroy when it is the first of multiple implements', () => {
      const input = `
import { Component, type OnDestroy, type OnInit } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';

@Component({})
export class C implements OnDestroy, OnInit {
  readonly sub = cleanSubscription();

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.sub.destroy();
  }
}`;

      const output = fixCode(input);
      expect(output).not.toContain('ngOnDestroy');
      expect(output).toContain('implements OnInit');
      expect(output).not.toContain('implements OnDestroy');
    });

    it('removes only OnDestroy when it is the last of multiple implements', () => {
      const input = `
import { Component, type OnDestroy, type OnInit } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';

@Component({})
export class C implements OnInit, OnDestroy {
  readonly sub = cleanSubscription();

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.sub.destroy();
  }
}`;

      const output = fixCode(input);
      expect(output).not.toContain('ngOnDestroy');
      expect(output).toContain('implements OnInit');
      expect(output).not.toContain(', OnDestroy');
    });

    it('removes only OnDestroy when it is in the middle of multiple implements', () => {
      const input = `
import { Component, type OnDestroy, type OnInit, type AfterViewInit } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';

@Component({})
export class C implements OnInit, OnDestroy, AfterViewInit {
  readonly sub = cleanSubscription();

  ngOnInit(): void {}
  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.sub.destroy();
  }
}`;

      const output = fixCode(input);
      expect(output).not.toContain('ngOnDestroy');
      expect(output).toContain('implements OnInit, AfterViewInit');
    });

    it('removes the implements clause when removing an empty ngOnDestroy', () => {
      const input = `
import { Component, type OnDestroy } from '@angular/core';

@Component({})
export class C implements OnDestroy {
  ngOnDestroy(): void {}
}`;

      const output = fixCode(input);
      expect(output).not.toContain('ngOnDestroy');
      expect(output).not.toContain('implements');
    });

    it('preserves the implements clause when ngOnDestroy is kept (mixed cleanup)', () => {
      const input = `
import { Component, type OnDestroy } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';

@Component({})
export class C implements OnDestroy {
  readonly sub = cleanSubscription();

  ngOnDestroy(): void {
    console.log('bye');
    this.sub.destroy();
  }
}`;

      const output = fixCode(input);
      expect(output).toContain('implements OnDestroy');
      expect(output).toContain('ngOnDestroy');
    });

    it('removes orphaned `implements OnDestroy` when no ngOnDestroy exists', () => {
      const input = `
import { Component, type OnDestroy } from '@angular/core';

@Component({})
export class C implements OnDestroy {
  readonly v = 1;
}`;

      const errors = lintCode(input);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('orphanedImplementsOnDestroy');

      const output = fixCode(input);
      expect(output).not.toContain('implements');
      expect(output).toContain('export class C {');
    });

    it('does not flag orphaned implements OnDestroy on a non-component class', () => {
      const input = `
import { type OnDestroy } from '@angular/core';

export class Plain implements OnDestroy {
  readonly v = 1;
}`;

      const errors = lintCode(input);
      expect(errors).toHaveLength(0);
    });

    it('does not touch implements when OnDestroy is not from @angular/core', () => {
      const input = `
import { Component } from '@angular/core';
import { OnDestroy } from './local-types';
import { cleanSubscription } from '@dereekb/dbx-core';

@Component({})
export class C implements OnDestroy {
  readonly sub = cleanSubscription();

  ngOnDestroy(): void {
    this.sub.destroy();
  }
}`;

      const output = fixCode(input);
      expect(output).not.toContain('ngOnDestroy');
      expect(output).toContain('implements OnDestroy');
    });
  });
});
