import { ChangeDetectionStrategy, Component, type OnInit, type OnDestroy, computed, inject, signal, effect, untracked, viewChild } from '@angular/core';
import { DynamicForm, EventDispatcher, type FormOptions } from '@ng-forge/dynamic-forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxForm, type DbxFormEvent, DbxFormState, DbxMutableForm } from '../../form/form';
import { type BooleanStringKeyArray, BooleanStringKeyArrayUtility } from '@dereekb/util';
import { SubscriptionObject } from '@dereekb/rxjs';
import { skip } from 'rxjs';
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
      <form [dynamic-form]="configSignal()!" [(value)]="formValue" [formOptions]="formOptionsSignal()"></form>
    }
  `,
  host: {
    class: 'dbx-forge',
    '[class.dbx-forge-form-disabled]': 'isDisabled()'
  },
  providers: [EventDispatcher, { provide: DbxForm, useExisting: DbxForgeFormContext }, { provide: DbxMutableForm, useExisting: DbxForgeFormContext }],
  imports: [DynamicForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeFormComponent<T = unknown> implements OnInit, OnDestroy {
  private readonly _context = inject(DbxForgeFormContext<T>);
  private readonly _setValueSub = new SubscriptionObject();
  private readonly _resetSub = new SubscriptionObject();
  private readonly _disabledSub = new SubscriptionObject();

  readonly dynamicForm = viewChild(DynamicForm);

  readonly formValue = signal<any>({});
  readonly configSignal = toSignal(this._context.config$, { initialValue: undefined });

  private readonly _changesCount = signal(0);
  private readonly _lastResetAt = signal(new Date());
  private readonly _isReset = signal(true);
  private readonly _disabled = signal<BooleanStringKeyArray>(undefined);

  readonly isDisabled = computed(() => BooleanStringKeyArrayUtility.isTrue(this._disabled()));

  readonly formOptionsSignal = computed((): FormOptions | undefined => {
    return this.isDisabled() ? { disabled: true } : undefined;
  });

  /**
   * Computed validity combining the ng-forge DynamicForm's valid signal with
   * validity from all registered wrapper nested forms.
   *
   * Wrapper fields (forgeFormFieldWrapper, forgeDbxSectionFieldWrapper, etc.) create
   * isolated DynamicForm instances whose validity is not visible to the parent
   * DynamicForm.valid(). They register their nested validity via
   * {@link DbxForgeFormContext.registerWrapperValidity}, and this computed combines both sources.
   */
  readonly formValid = computed(() => (this.dynamicForm()?.valid() ?? false) && this._context.allWrappersValid());

  /**
   * Track form value changes and update the context value + changes count.
   *
   * Only `formValue()` is tracked — all other signal reads use `untracked()`
   * to avoid infinite re-triggering from writing back to signals in this effect.
   */
  protected readonly _formValueEffect = effect(() => {
    const value = this.formValue();

    untracked(() => {
      this._context.updateValue(value);

      const changesCount = this._changesCount() + 1;
      this._changesCount.set(changesCount);

      const isReset = changesCount <= 1;
      this._isReset.set(isReset);

      this._emitFormState();
    });
  });

  /**
   * Expose the parent DynamicForm's field tree to the context so wrapper components
   * can write to sibling hidden fields in the parent form.
   */
  protected readonly _parentFormTreeEffect = effect(() => {
    const formTree = this.dynamicForm()?.form();
    untracked(() => {
      this._context.setParentFormTree(formTree as any);
    });
  });

  /**
   * Track validity changes from the DynamicForm and update the context.
   *
   * Separated from the value effect so that validity changes (e.g. async validators resolving)
   * update isComplete and status without incrementing changesCount.
   */
  protected readonly _validityEffect = effect(() => {
    const isValid = this.formValid();

    untracked(() => {
      this._context.updateIsValid(isValid);
      this._emitFormState();
    });
  });

  protected _emitFormState(): void {
    const isValid = this.formValid();
    const isReset = this._isReset();
    const changesCount = this._changesCount();

    const suppressComplete = this.isDisabled() && !this._context.emitValueWhenDisabled;

    const state: DbxFormEvent = {
      isComplete: suppressComplete ? false : isValid,
      status: this.isDisabled() ? 'DISABLED' : isValid ? 'VALID' : 'INVALID',
      state: isReset ? DbxFormState.RESET : DbxFormState.USED,
      pristine: isReset,
      untouched: isReset,
      changesCount,
      isDisabled: this.isDisabled(),
      disabled: this._disabled(),
      lastResetAt: this._lastResetAt()
    };

    this._context.updateFormState(state);
  }

  /**
   * The last value passed to setValue, used as the reset target.
   * Mirrors formly's behavior where resetForm() restores the initial value
   * rather than clearing to `{}`. This prevents ng-forge's two-way [(value)]
   * binding from writing back empty field defaults that overwrite a
   * subsequent dbxFormSource re-apply.
   */

  private _initialValue: any = {};

  ngOnInit(): void {
    // Listen for setValue from context.
    // Marks the form as USED after applying the value so that dbxFormSource's
    // distinctUntilChanged on state$ can detect subsequent resetForm() calls
    // as USED→RESET transitions. Uses changesCount=100 to ensure the value
    // stays above 1 even after the _formValueEffect increments from a
    // concurrent resetForm's _resetState (which sets changesCount=0).
    this._setValueSub.subscription = this._context.setValue$.subscribe((value) => {
      if (value != null) {
        this._initialValue = value;
        this._changesCount.set(100);
        this._isReset.set(false);
        this.formValue.set(value as T);
        this._emitFormState();
      }
    });

    // Listen for reset from context.
    // Restores the form to the last setValue value (not {}) to match formly behavior
    // and avoid ng-forge's two-way binding overwriting a pending dbxFormSource re-apply.
    //
    // NOTE: _resetState() + formValue update are done here, but _emitFormState()
    // is NOT called. The context's stream$ uses switchMap on _reset, so when
    // _reset fires (from context.resetForm()), the switchMap creates a new inner
    // subscription to _formState. We update _formState via _emitFormState() in
    // a microtask so the new inner subscription is ready to receive it.
    this._resetSub.subscription = this._context.reset$.pipe(skip(1)).subscribe(() => {
      this._resetState();
      this.formValue.set(structuredClone(this._initialValue));
      // Emit on next microtask so the switchMap in stream$ has restarted
      void Promise.resolve().then(() => this._emitFormState());
    });

    // Listen for disabled state changes from context
    this._disabledSub.subscription = this._context.disabled$.subscribe((disabled) => {
      this._disabled.set(disabled);
      this._emitFormState();
    });
  }

  private _resetState(): void {
    this._changesCount.set(0);
    this._isReset.set(true);
    this._lastResetAt.set(new Date());
  }

  ngOnDestroy(): void {
    this._setValueSub.destroy();
    this._resetSub.destroy();
    this._disabledSub.destroy();
  }
}
