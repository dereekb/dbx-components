import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { DBX_WEB_ESLINT_PLUGIN } from './plugin';

const RULE_ID = 'dereekb-dbx-web/require-top-level-computed-signals';

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

function fixCode(code: string): string {
  const linter = new Linter({ configType: 'flat' });
  return linter.verifyAndFix(code, makeConfig(), { filename: 'test.ts' }).output;
}

describe('require-top-level-computed-signals rule', () => {
  describe('should pass', () => {
    it('all signal reads at the top of the computed body', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class GoodComponent {
          readonly flag = signal(false);
          readonly a = signal(0);
          readonly b = signal(0);
          readonly resultSignal = computed(() => {
            const flag = this.flag();
            const a = this.a();
            const b = this.b();
            return flag ? a : b;
          });
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('signal read in the test of an if-statement (always evaluated)', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class GoodComponent {
          readonly items = signal<readonly number[]>([]);
          readonly hasItemsSignal = computed(() => {
            if (this.items().length > 0) {
              return true;
            }
            return false;
          });
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('signal read on the left of a logical expression (always evaluated)', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class GoodComponent {
          readonly value = signal<string | null>(null);
          readonly fallback = signal('default');
          readonly resolvedSignal = computed(() => {
            const value = this.value();
            const fallback = this.fallback();
            return value ?? fallback;
          });
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('signal read inside a nested .map callback is not flagged', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class GoodComponent {
          readonly ids = signal<readonly string[]>([]);
          readonly labelSignal = computed(() => {
            const ids = this.ids();
            return ids.map((id) => {
              if (id) {
                return id.toUpperCase();
              }
              return '';
            });
          });
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('computed from a non-@angular/core source is not inspected', () => {
      const errors = lintCode(`
        import { Component, signal } from '@angular/core';
        import { computed } from 'other-lib';

        @Component({})
        export class FineComponent {
          readonly flag = signal(false);
          readonly other = signal(0);
          readonly totalSignal = computed(() => {
            if (this.flag()) {
              return 1;
            }
            return this.other();
          });
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('computed with an expression body (no branching) is not flagged', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class GoodComponent {
          readonly count = signal(0);
          readonly doubledSignal = computed(() => this.count() * 2);
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it('calls with arguments are not treated as signal reads', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class GoodComponent {
          readonly value = signal(0);
          readonly labelSignal = computed(() => {
            const value = this.value();
            if (value > 0) {
              return String(value);
            }
            return formatNegative(value);
          });
        }

        function formatNegative(value: number): string { return '-' + value; }
      `);

      expect(errors).toHaveLength(0);
    });

    // Regression: plain instance methods on the same class are not signal getters.
    it('plain class methods on this are not treated as signal reads', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class GoodComponent {
          readonly flag = signal(false);
          readonly resultSignal = computed(() => {
            if (this.flag()) {
              return this.computeAlpha();
            }
            return this.computeBeta();
          });

          private computeAlpha(): number { return 1; }
          private computeBeta(): number { return 0; }
        }
      `);

      expect(errors).toHaveLength(0);
    });

    // Regression: getter methods on injected services are not signals — they
    // simply expose internal state synchronously and have no tracking effect.
    it('chained zero-arg method calls on injected services are not flagged', () => {
      const errors = lintCode(`
        import { Component, computed, signal, inject } from '@angular/core';

        class HelpWidgetService {
          getDefaultIcon(): string | undefined { return undefined; }
          getHelpListHeaderConfig(): unknown { return null; }
        }

        @Component({})
        export class GoodComponent {
          private readonly helpWidgetService = inject(HelpWidgetService);
          readonly flag = signal(false);
          readonly resolvedSignal = computed(() => {
            if (this.flag()) {
              return this.helpWidgetService.getDefaultIcon();
            }
            return this.helpWidgetService.getHelpListHeaderConfig();
          });
        }
      `);

      expect(errors).toHaveLength(0);
    });

    // Regression: bare-identifier utility functions imported from other
    // libraries are not signals and must not be flagged.
    it('bare-identifier utility function calls are not flagged', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';
        import { guessCurrentTimezone } from 'date-fns-extras';

        @Component({})
        export class GoodComponent {
          readonly timezone = signal<string | null>(null);
          readonly resolvedSignal = computed(() => this.timezone() ?? guessCurrentTimezone());
        }
      `);

      expect(errors).toHaveLength(0);
    });

    // Regression: zero-arg method calls on local variables are array/string
    // methods, not signal reads.
    it('zero-arg method calls on local variables are not flagged', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class GoodComponent {
          readonly side = signal<'left' | 'right'>('left');
          readonly orderedSignal = computed(() => {
            const side = this.side();
            let icons = ['a', 'b'];
            if (side === 'left') {
              icons = icons.reverse();
            }
            return icons;
          });
        }
      `);

      expect(errors).toHaveLength(0);
    });

    // Regression: zero-arg method calls on globals (Math.random, Date.now)
    // are not signal reads.
    it('zero-arg method calls on bare globals are not flagged', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class GoodComponent {
          readonly flag = signal(false);
          readonly randomSignal = computed(() => {
            if (this.flag()) {
              return Math.random();
            }
            return Date.now();
          });
        }
      `);

      expect(errors).toHaveLength(0);
    });

    // Regression: for...of loop variables that happen to be called as
    // functions (e.g. iterating over an array of signal getters) cannot be
    // statically distinguished from any other locally-bound callable, so they
    // are intentionally not flagged.
    it('for-of loop-variable calls are not flagged', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class GoodComponent {
          private readonly _signals: (() => boolean)[] = [];
          readonly allValidSignal = computed(() => {
            let valid = true;
            for (const s of this._signals) {
              if (!s()) {
                valid = false;
              }
            }
            return valid;
          });
        }
      `);

      expect(errors).toHaveLength(0);
    });

    // Regression: `computed` returns a Signal; once consumed via `signalValue`
    // the call is no longer a getter on `this`, so chained property reads
    // through it must not be flagged either.
    it('chained property access through this.X.Y() is not flagged', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class GoodComponent {
          readonly flag = signal(false);
          readonly state = { isReady: () => true };
          readonly resultSignal = computed(() => {
            if (this.flag()) {
              return this.state.isReady();
            }
            return false;
          });
        }
      `);

      expect(errors).toHaveLength(0);
    });
  });

  describe('should fail', () => {
    it('signal reads inside both branches of an if/else', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly flag = signal(false);
          readonly a = signal(1);
          readonly b = signal(2);
          readonly resultSignal = computed(() => {
            if (this.flag()) {
              return this.a();
            } else {
              return this.b();
            }
          });
        }
      `);

      expect(errors).toHaveLength(2);
      expect(errors[0].messageId).toBe('conditionalSignalRead');
      expect(errors[1].messageId).toBe('conditionalSignalRead');
    });

    it('signal read inside the consequent of an if-statement (early return)', () => {
      // NOTE: Only the call inside the `if` body is in a syntactic conditional
      // path. The call after the if is at the top-level of the BlockStatement
      // and is therefore not flagged by this rule — even though, semantically,
      // it only runs when `this.flag()` is false. Hoisting it is still good
      // practice, but the rule does not perform flow-sensitive analysis.
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly flag = signal(false);
          readonly a = signal(1);
          readonly b = signal(2);
          readonly resultSignal = computed(() => {
            if (this.flag()) {
              return this.a();
            }
            return this.b();
          });
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('conditionalSignalRead');
    });

    it('signal read inside the alternate of a ternary expression', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly flag = signal(false);
          readonly a = signal(1);
          readonly b = signal(2);
          readonly resultSignal = computed(() => this.flag() ? this.a() : this.b());
        }
      `);

      expect(errors).toHaveLength(2);
    });

    it('signal read on the right of a short-circuit logical expression', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly primary = signal<string | null>(null);
          readonly fallback = signal('x');
          readonly resolvedSignal = computed(() => this.primary() ?? this.fallback());
        }
      `);

      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('conditionalSignalRead');
    });

    it('signal read inside a switch case body', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly mode = signal<'a' | 'b'>('a');
          readonly a = signal(1);
          readonly b = signal(2);
          readonly resultSignal = computed(() => {
            switch (this.mode()) {
              case 'a': return this.a();
              default: return this.b();
            }
          });
        }
      `);

      expect(errors).toHaveLength(2);
    });

    it('signal read inside a loop body', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly count = signal(0);
          readonly side = signal(1);
          readonly resultSignal = computed(() => {
            let total = 0;
            for (let i = 0; i < this.count(); i += 1) {
              total += this.side();
            }
            return total;
          });
        }
      `);

      expect(errors).toHaveLength(1);
    });

    it('signal read inside a catch handler', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly primary = signal(() => 1);
          readonly fallback = signal(0);
          readonly resultSignal = computed(() => {
            try {
              return this.primary()();
            } catch {
              return this.fallback();
            }
          });
        }
      `);

      expect(errors).toHaveLength(1);
    });

    // input() / input.required() / model() / model.required() / linkedSignal()
    it('input()/model()/linkedSignal class properties are recognized as signals', () => {
      const errors = lintCode(`
        import { Component, computed, input, model, linkedSignal } from '@angular/core';

        @Component({})
        export class BadComponent {
          readonly flag = input.required<boolean>();
          readonly value = model<number>(0);
          readonly cached = linkedSignal(() => 0);
          readonly resultSignal = computed(() => this.flag() ? this.value() : this.cached());
        }
      `);

      expect(errors).toHaveLength(2);
    });

    // toSignal() from @angular/core/rxjs-interop
    it('toSignal() class properties are recognized as signals', () => {
      const errors = lintCode(`
        import { Component, computed, signal } from '@angular/core';
        import { toSignal } from '@angular/core/rxjs-interop';

        declare const obs$: { subscribe: () => void };

        @Component({})
        export class BadComponent {
          readonly flag = signal(false);
          readonly fromObs = toSignal(obs$ as never, { initialValue: 0 });
          readonly resultSignal = computed(() => this.flag() ? this.fromObs() : 0);
        }
      `);

      expect(errors).toHaveLength(1);
    });

    // Type-annotated signal property without a recognized factory initializer.
    it('properties typed as Signal<T> are recognized as signals', () => {
      const errors = lintCode(`
        import { Component, computed, signal, type Signal, type InputSignal } from '@angular/core';

        declare function buildSignal<T>(): Signal<T>;

        @Component({})
        export class BadComponent {
          readonly flag = signal(false);
          readonly externalSignal: Signal<number> = buildSignal<number>();
          readonly inputSignal: InputSignal<string>;
          readonly resultSignal = computed(() => this.flag() ? this.externalSignal() : this.inputSignal().length);
        }
      `);

      // externalSignal() is in the consequent; inputSignal() is in the
      // alternate.length but the call this.inputSignal() itself is in the
      // alternate, so both reads are conditional.
      expect(errors).toHaveLength(2);
    });

    // Module-level signal const captured in a computed declared at module scope.
    it('module-level signal const reads are flagged when conditional', () => {
      const errors = lintCode(`
        import { computed, signal } from '@angular/core';

        const flagSignalValue = signal(false);
        const altSignalValue = signal(1);
        const baseSignalValue = signal(0);

        export const resultSignal = computed(() => {
          if (flagSignalValue()) {
            return altSignalValue();
          } else {
            return baseSignalValue();
          }
        });
      `);

      expect(errors).toHaveLength(2);
    });

    // Negative for module scope: an arrow-function const at module scope is
    // not a signal — make sure the bare-identifier path doesn't false-positive.
    it('module-level non-signal const calls are not flagged', () => {
      const errors = lintCode(`
        import { computed, signal } from '@angular/core';

        const flagSignalValue = signal(false);
        const helper = () => 1;

        export const resultSignal = computed(() => {
          if (flagSignalValue()) {
            return helper();
          }
          return 0;
        });
      `);

      expect(errors).toHaveLength(0);
    });
  });

  describe('autofix', () => {
    it('hoists a single conditional signal read inside a block body', () => {
      const fixed = fixCode(`
import { Component, computed, signal } from '@angular/core';

@Component({})
export class Foo {
  readonly flag = signal(false);
  readonly aSignal = signal(1);
  readonly bSignal = signal(2);
  readonly resultSignal = computed(() => {
    if (this.flag()) {
      return this.aSignal();
    } else {
      return this.bSignal();
    }
  });
}
`);

      expect(fixed).toContain('const a = this.aSignal();');
      expect(fixed).toContain('const b = this.bSignal();');
      expect(fixed).toContain('return a;');
      expect(fixed).toContain('return b;');
      expect(fixed).not.toMatch(/return this\.aSignal\(\)/);
      expect(fixed).not.toMatch(/return this\.bSignal\(\)/);
    });

    it('hoists each unique signal once even when read in multiple branches', () => {
      const fixed = fixCode(`
import { Component, computed, signal } from '@angular/core';

@Component({})
export class Foo {
  readonly mode = signal<'a' | 'b' | 'c'>('a');
  readonly aSignal = signal(1);
  readonly resultSignal = computed(() => {
    if (this.mode() === 'a') {
      return this.aSignal();
    } else if (this.mode() === 'b') {
      return this.aSignal() + 1;
    } else {
      return this.aSignal() * 2;
    }
  });
}
`);

      const hoistMatches = fixed.match(/const a = this\.aSignal\(\);/g) ?? [];

      expect(hoistMatches.length).toBe(1);
      expect(fixed).not.toMatch(/this\.aSignal\(\)/g.test(fixed.replace('const a = this.aSignal();', '')) ? /this\.aSignal\(\)/ : /never-matches/);
      expect(fixed).toContain('return a;');
      expect(fixed).toContain('return a + 1;');
      expect(fixed).toContain('return a * 2;');
    });

    it('converts a ternary expression body to a block body with hoists', () => {
      const fixed = fixCode(`
import { Component, computed, signal } from '@angular/core';

@Component({})
export class Foo {
  readonly flag = signal(false);
  readonly aSignal = signal(1);
  readonly bSignal = signal(2);
  readonly resultSignal = computed(() => this.flag() ? this.aSignal() : this.bSignal());
}
`);

      expect(fixed).toContain('const a = this.aSignal();');
      expect(fixed).toContain('const b = this.bSignal();');
      expect(fixed).toMatch(/return this\.flag\(\) \? a : b;/);
    });

    it('converts a short-circuit expression body to a block body with hoists', () => {
      const fixed = fixCode(`
import { Component, computed, signal } from '@angular/core';

@Component({})
export class Foo {
  readonly primary = signal<number | null>(null);
  readonly fallbackSignal = signal(0);
  readonly resolvedSignal = computed(() => this.primary() ?? this.fallbackSignal());
}
`);

      expect(fixed).toContain('const fallback = this.fallbackSignal();');
      expect(fixed).toMatch(/return this\.primary\(\) \?\? fallback;/);
    });

    it('preserves a leading underscore on the local variable name', () => {
      const fixed = fixCode(`
import { Component, computed, signal } from '@angular/core';

@Component({})
export class Foo {
  readonly flag = signal(false);
  readonly _configSignal = signal({ value: 1 });
  readonly resultSignal = computed(() => this.flag() ? this._configSignal() : null);
}
`);

      expect(fixed).toContain('const _config = this._configSignal();');
      expect(fixed).toMatch(/return this\.flag\(\) \? _config : null;/);
    });

    it('uses the property name as-is when there is no Signal suffix', () => {
      const fixed = fixCode(`
import { Component, computed, signal } from '@angular/core';

@Component({})
export class Foo {
  readonly flag = signal(false);
  readonly config = signal({ value: 1 });
  readonly resultSignal = computed(() => {
    if (this.flag()) {
      return this.config();
    } else {
      return null;
    }
  });
}
`);

      expect(fixed).toContain('const config = this.config();');
      expect(fixed).toContain('return config;');
    });

    it('hoists a module-level captured signal read', () => {
      const fixed = fixCode(`
import { computed, signal } from '@angular/core';

const flagSignal = signal(false);
const valueSignal = signal(42);

export const resultSignal = computed(() => flagSignal() ? valueSignal() : 0);
`);

      expect(fixed).toContain('const value = valueSignal();');
      expect(fixed).toMatch(/return flagSignal\(\) \? value : 0;/);
    });

    it('skips the hoist for a signal whose stripped name would shadow an existing local', () => {
      const fixed = fixCode(`
import { Component, computed, signal } from '@angular/core';

@Component({})
export class Foo {
  readonly flag = signal(false);
  readonly aSignal = signal(10);
  readonly bSignal = signal(20);
  readonly resultSignal = computed(() => {
    const a = 1; // existing local — collides with the hoist for aSignal
    if (this.flag()) {
      return a + this.aSignal();
    } else {
      return a + this.bSignal();
    }
  });
}
`);

      // bSignal still gets hoisted, aSignal is left alone.
      expect(fixed).toContain('const b = this.bSignal();');
      expect(fixed).toContain('return a + this.aSignal();');
      expect(fixed).toContain('return a + b;');
      expect(fixed).not.toContain('const a = this.aSignal();');
    });

    it('does not hoist non-flagged call sites of the same signal (left of a short-circuit)', () => {
      const fixed = fixCode(`
import { Component, computed, signal } from '@angular/core';

@Component({})
export class Foo {
  readonly primary = signal<number | null>(null);
  readonly fallbackSignal = signal(0);
  readonly resolvedSignal = computed(() => this.primary() ?? this.fallbackSignal());
}
`);

      // The first this.primary() runs unconditionally, so it is NOT a
      // candidate for the autofix replacement — only this.fallbackSignal()
      // is rewritten.
      expect(fixed).toContain('this.primary()');
      expect(fixed).toContain('const fallback = this.fallbackSignal();');
      expect(fixed).not.toContain('this.fallbackSignal() ?? fallback');
    });

    it('preserves the original block-body indentation when hoisting', () => {
      const fixed = fixCode(`
import { Component, computed, signal } from '@angular/core';

@Component({})
export class Foo {
  readonly flag = signal(false);
  readonly aSignal = signal(1);
  readonly bSignal = signal(2);
  readonly resultSignal = computed(() => {
    if (this.flag()) {
      return this.aSignal();
    } else {
      return this.bSignal();
    }
  });
}
`);

      // The hoisted const lines should sit at the same 4-space indent as the
      // existing block content, and the surviving `if` should still be at 4
      // spaces — no characters lost or gained.
      expect(fixed).toMatch(/\n {4}const a = this\.aSignal\(\);\n {4}const b = this\.bSignal\(\);\n {4}if /);
    });

    it('produces no warnings after a single --fix pass on a block body', () => {
      const fixed = fixCode(`
import { Component, computed, signal } from '@angular/core';

@Component({})
export class Foo {
  readonly flag = signal(false);
  readonly aSignal = signal(1);
  readonly bSignal = signal(2);
  readonly resultSignal = computed(() => {
    if (this.flag()) {
      return this.aSignal();
    } else {
      return this.bSignal();
    }
  });
}
`);

      expect(lintCode(fixed)).toHaveLength(0);
    });

    it('produces no warnings after a single --fix pass on an expression body', () => {
      const fixed = fixCode(`
import { Component, computed, signal } from '@angular/core';

@Component({})
export class Foo {
  readonly flag = signal(false);
  readonly aSignal = signal(1);
  readonly bSignal = signal(2);
  readonly resultSignal = computed(() => this.flag() ? this.aSignal() : this.bSignal());
}
`);

      expect(lintCode(fixed)).toHaveLength(0);
    });
  });
});
