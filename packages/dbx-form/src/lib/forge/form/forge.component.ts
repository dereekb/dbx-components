import { ChangeDetectionStrategy, Component, type OnInit, type OnDestroy, computed, inject, signal, effect, untracked, viewChild } from '@angular/core';
import { DynamicForm, EventDispatcher, type FormOptions } from '@ng-forge/dynamic-forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxForm, type DbxFormEvent, DbxFormState, DbxMutableForm } from '../../form/form';
import { type BooleanStringKeyArray, BooleanStringKeyArrayUtility, filterUndefinedValues, type Maybe, type FilterFromPOJOFunction, areEqualPOJOValuesUsingPojoFilter } from '@dereekb/util';
import { SubscriptionObject } from '@dereekb/rxjs';
import { skip } from 'rxjs';
import { DbxForgeFormContext } from './forge.context';
import { DbxForgeDynamicFormSignalRef, DbxForgeFormContextService } from './forge.context.service';

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
  providers: [EventDispatcher, { provide: DbxForgeDynamicFormSignalRef, useExisting: DbxForgeFormComponent }, DbxForgeFormContextService, { provide: DbxForm, useExisting: DbxForgeFormContext }, { provide: DbxMutableForm, useExisting: DbxForgeFormContext }],
  imports: [DynamicForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeFormComponent<T extends object = object> implements DbxForgeDynamicFormSignalRef, OnInit, OnDestroy {
  private readonly _context = inject(DbxForgeFormContext<T>);

  private readonly _setValueSub = new SubscriptionObject();
  private readonly _resetSub = new SubscriptionObject();
  private readonly _disabledSub = new SubscriptionObject();

  readonly dynamicForm = viewChild(DynamicForm);

  readonly formValue = signal<T>({} as T, { equal: (a, b) => _forgeFormValueEqual(a, b, this._context) });
  readonly configSignal = toSignal(this._context.config$, { initialValue: undefined });

  private readonly _changesCount = signal(0);
  private readonly _lastResetAt = signal(new Date());
  private readonly _isReset = signal(true);
  private readonly _disabled = signal<BooleanStringKeyArray>(undefined);

  /**
   * True once ng-forge has finished its synchronous initialization: the config
   * has arrived, the DynamicForm view child is populated, and ng-forge has
   * performed its initial field-default writebacks via the two-way [(value)]
   * binding. A setValue that arrives before this point would be clobbered by
   * those writebacks, so we queue it until ready.
   *
   * The form is kept in RESET state while not ready so that
   * {@link DbxFormSourceDirective} 'reset' mode still forwards an
   * asynchronously-resolving value once it arrives.
   */
  private readonly _formReady = signal(false);

  /**
   * A setValue payload received while {@link _formReady} was false. Applied
   * once ready; only the most recent pending value is retained.
   *
   * Wrapped in a single-element object so we can distinguish "no pending
   * value" (undefined) from "pending value of undefined/null" (object present
   * with a null/undefined inner value).
   */
  private _pendingValue: Maybe<{ value: Maybe<Partial<T>> }> = undefined;

  readonly isDisabled = computed(() => BooleanStringKeyArrayUtility.isTrue(this._disabled()));

  readonly formOptionsSignal = computed((): FormOptions | undefined => {
    return this.isDisabled() ? { disabled: true } : undefined;
  });

  /**
   * Computed validity combining the ng-forge DynamicForm's valid signal with
   * validity from all registered wrapper nested forms.
   *
   * Wrapper fields (forgeFormFieldWrapper, section wrapper, etc.) create
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
   *
   * While the form is not yet ready (see {@link _formReady}), any formValue
   * change that arrives through ng-forge's two-way [(value)] binding is
   * treated as an initialization artifact: the context value is still synced,
   * but the form is held in RESET state (changesCount clamped at 1) so that
   * {@link DbxFormSourceDirective} in 'reset' mode can still forward an
   * async source value once it arrives.
   */
  protected readonly _formValueEffect = effect(() => {
    const value = this.formValue();

    untracked(() => {
      this._context.updateValue(value);

      if (!this._formReady()) {
        if (this._changesCount() === 0) {
          this._changesCount.set(1);
          this._isReset.set(true);
          this._emitFormState();
        }
      } else {
        const changesCount = this._changesCount() + 1;
        this._changesCount.set(changesCount);

        const isReset = changesCount <= 1;
        this._isReset.set(isReset);

        this._emitFormState();
      }
    });
  });

  /**
   * Marks the form as ready once the ng-forge DynamicForm view child is
   * populated. The viewChild signal updates after ng-forge has completed its
   * synchronous initialization (including any field-default writebacks), so
   * setting ready here is safe — the writebacks have already happened and
   * been absorbed by the not-ready branch of {@link _formValueEffect}.
   *
   * Applies any queued setValue payload immediately upon becoming ready so
   * that the user-intended value wins over ng-forge's defaults.
   */
  protected readonly _formReadyEffect = effect(() => {
    const df = this.dynamicForm();
    if (df && !untracked(() => this._formReady())) {
      untracked(() => {
        this._formReady.set(true);

        const pending = this._pendingValue;
        if (pending != null) {
          this._pendingValue = undefined;
          this._applySetValueNow(pending.value);
        }
      });
    }
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
    //
    // If the form is not yet ready (ng-forge DynamicForm has not rendered
    // and written its initial field defaults), the value is queued and
    // applied by _formReadyEffect once the form becomes ready. This covers:
    //   (a) setValue called before the config$ has emitted (form not rendered)
    //   (b) setValue called after config but before ng-forge's init writeback
    //       has settled (would otherwise be clobbered by the writeback)
    this._setValueSub.subscription = this._context.setValue$.subscribe((value) => {
      if (value != null) {
        if (this._formReady()) {
          this._applySetValueNow(value);
        } else {
          this._pendingValue = { value };
        }
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

  private _applySetValueNow(value: Maybe<Partial<T>>): void {
    // Strip keys whose value is `undefined` before writing to the ng-forge
    // two-way binding. @angular/forms/signals throws NG01902 "Orphan field"
    // when a registered field's key resolves to `undefined` in the model —
    // stripping avoids that crash while still preserving `null`, empty
    // strings, and empty arrays (which are valid field values).
    const sanitized = value != null && typeof value === 'object' ? (filterUndefinedValues(value as object) as Partial<T>) : value;
    this._initialValue = sanitized;
    this._changesCount.set(100);
    this._isReset.set(false);
    this.formValue.set(sanitized as T);
    this._emitFormState();
  }

  ngOnDestroy(): void {
    this._setValueSub.destroy();
    this._resetSub.destroy();
    this._disabledSub.destroy();
  }
}

/**
 * Deep-equality comparator for the {@link DbxForgeFormComponent.formValue} signal.
 *
 * ng-forge's outward sync effect writes entity values back through the
 * `[(value)]` two-way binding. Each write creates a new object reference even
 * when the content is identical. Without this guard the `_formValueEffect`
 * re-fires on every write-back, which triggers `updateValue` (stripping
 * internal/empty keys) and `_emitFormState`, creating an infinite effect cycle
 * that leads to OOM.
 *
 * The filter used depends on the context's configuration:
 * - Custom {@link DbxForgeFormContext.formValuePojoFilter} if set
 * - Default filter that strips `_`-prefixed keys and null/undefined values
 *   when {@link DbxForgeFormContext.stripInternalKeys} is true (default)
 * - Null/undefined-only filter when `stripInternalKeys` is false
 */
function _forgeFormValueEqual<T>(a: T, b: T, context: DbxForgeFormContext<T>): boolean {
  const pojoFilter = context.formValuePojoFilter ?? (context.stripInternalKeys ? _filterForgeFormValueStripInternal : _filterForgeFormValueKeepInternal);
  return areEqualPOJOValuesUsingPojoFilter(a, b, pojoFilter as FilterFromPOJOFunction<T>);
}

/**
 * Default filter: strips `_`-prefixed keys (ng-forge internal/layout keys)
 * and null/undefined values before deep equality comparison.
 *
 * The `_`-prefixed keys can reference complex, self-referencing ng-forge
 * objects (field trees, form instances) that cause stack overflows during
 * recursive comparison. They are layout artifacts and irrelevant for
 * value equality.
 */
function _filterForgeFormValueStripInternal<T>(input: T): T {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }

  const comparisonObject: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
    if (val != null && !key.startsWith('_')) {
      comparisonObject[key] = val;
    }
  }

  return comparisonObject as T;
}

/**
 * Filter used when `stripInternalKeys` is false: retains `_`-prefixed keys
 * but still strips null/undefined values.
 */
function _filterForgeFormValueKeepInternal<T>(input: T): T {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }

  const comparisonObject: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
    if (val != null) {
      comparisonObject[key] = val;
    }
  }

  return comparisonObject as T;
}
