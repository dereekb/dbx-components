import { ChangeDetectionStrategy, Component, type OnInit, type OnDestroy, computed, inject, signal, effect, untracked } from '@angular/core';
import { DynamicForm, EventDispatcher } from '@ng-forge/dynamic-forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxForm, type DbxFormEvent, DbxFormState, DbxMutableForm } from '../../form/form';
import { type BooleanStringKeyArray, BooleanStringKeyArrayUtility } from '@dereekb/util';
import { SubscriptionObject } from '@dereekb/rxjs';
import { DbxForgeFormContext } from './forge.context';

/**
 * Wraps ng-forge's DynamicForm and bridges it to the DbxForm system.
 *
 * Uses ng-forge's signal-based form value and derives DbxFormEvent state
 * from signal reads rather than complex Observable chains.
 */
@Component({
  selector: 'dbx-forge',
  template: `
    @if (configSignal()) {
      <form [dynamic-form]="configSignal()!" [(value)]="formValue"></form>
    }
  `,
  host: { class: 'dbx-forge' },
  providers: [EventDispatcher, { provide: DbxForm, useExisting: DbxForgeFormContext }, { provide: DbxMutableForm, useExisting: DbxForgeFormContext }],
  imports: [DynamicForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeFormComponent<T = unknown> implements OnInit, OnDestroy {
  private readonly _context = inject(DbxForgeFormContext<T>);
  private readonly _subs = new SubscriptionObject();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly formValue = signal<any>({});
  readonly configSignal = toSignal(this._context.config$, { initialValue: undefined });

  private readonly _changesCount = signal(0);
  private readonly _lastResetAt = signal(new Date());
  private readonly _isReset = signal(true);
  private readonly _disabled = signal<BooleanStringKeyArray>(undefined);

  readonly isDisabled = computed(() => BooleanStringKeyArrayUtility.isTrue(this._disabled()));

  /**
   * Track form value changes and derive DbxFormEvent state.
   *
   * Only `formValue()` is tracked — all other signal reads use `untracked()`
   * to avoid infinite re-triggering from writing back to signals in this effect.
   */
  private readonly _formValueEffect = effect(() => {
    const value = this.formValue();

    untracked(() => {
      this._context.updateValue(value);

      const changesCount = this._changesCount() + 1;
      this._changesCount.set(changesCount);

      const isReset = changesCount <= 1;
      this._isReset.set(isReset);

      const state: DbxFormEvent = {
        isComplete: !this.isDisabled(),
        status: this.isDisabled() ? 'DISABLED' : 'VALID',
        state: isReset ? DbxFormState.RESET : DbxFormState.USED,
        pristine: isReset,
        untouched: isReset,
        changesCount,
        isDisabled: this.isDisabled(),
        disabled: this._disabled(),
        lastResetAt: this._lastResetAt()
      };

      this._context.updateFormState(state);
    });
  });

  ngOnInit(): void {
    // Listen for setValue from context
    this._subs.subscription = this._context.setValue$.subscribe((value) => {
      if (value != null) {
        this.formValue.set(value as T);
        this._resetState();
      }
    });
  }

  private _resetState(): void {
    this._changesCount.set(0);
    this._isReset.set(true);
    this._lastResetAt.set(new Date());
  }

  ngOnDestroy(): void {
    this._subs.destroy();
  }
}
