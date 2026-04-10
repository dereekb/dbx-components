import { Injectable, type OnDestroy, type Provider, type Signal, signal, computed } from '@angular/core';
import { BehaviorSubject, combineLatest, type Observable, shareReplay, switchMap, filter, map } from 'rxjs';
import { type DbxMutableForm, type DbxFormEvent, type DbxFormDisabledKey, DbxFormState, DEFAULT_FORM_DISABLED_KEY, provideDbxMutableForm } from '../../form/form';
import { type BooleanStringKeyArray, BooleanStringKeyArrayUtility, type Maybe } from '@dereekb/util';
import { LockSet, filterMaybe } from '@dereekb/rxjs';
import { type FormConfig } from '@ng-forge/dynamic-forms';

/**
 * Recursively strips keys that start with `_` from a form value object.
 *
 * ng-forge wrapper/layout fields (sections, toggles, expand, rows) use auto-generated
 * keys prefixed with `_` (e.g. `_section_1`, `_toggle_2`). These are layout artifacts
 * and should not appear in the final form output.
 *
 * - Object values under `_` keys are "unwrapped": their contents are merged into the parent.
 * - Primitive values under `_` keys (e.g. toggle booleans) are dropped entirely.
 * - Non-underscore keys are preserved, with recursive cleaning of nested objects.
 *
 * @example
 * ```
 * stripForgeInternalKeys({ _toggle_1: false, _section_6: { name: "Bob" } })
 * // → { name: "Bob" }
 * ```
 */
export function stripForgeInternalKeys<T>(value: T): T {
  if (value == null || typeof value !== 'object' || Array.isArray(value) || value instanceof Date) {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith('_')) {
      if (val != null && typeof val === 'object' && !Array.isArray(val)) {
        Object.assign(result, stripForgeInternalKeys(val));
      }
      // Primitive _ keys (toggle booleans, etc.) are dropped
    } else {
      result[key] = stripForgeInternalKeys(val);
    }
  }

  return result as T;
}

/**
 * Returns true if a value is considered "empty" for forge form output purposes.
 *
 * Empty means: `null`, `undefined`, or empty string `""`.
 * Note: `false`, `0`, empty arrays `[]`, and other falsy values are NOT empty.
 */
function isEmptyFormValue(val: unknown): boolean {
  return val === null || val === undefined || val === '';
}

/**
 * Recursively strips keys whose values are empty (`null`, `undefined`, or `""`)
 * from a form value object. Also removes keys whose values become empty objects
 * `{}` after recursive stripping.
 *
 * This normalizes ng-forge output to match ngx-formly behavior, where the model
 * only includes keys that have been explicitly set by the user.
 *
 * @example
 * ```
 * stripEmptyForgeValues({ name: "", age: null, active: false, count: 0 })
 * // → { active: false, count: 0 }
 *
 * stripEmptyForgeValues({ section: { a: "", b: "" } })
 * // → {}
 * ```
 */
export function stripEmptyForgeValues<T>(value: T): T {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isEmptyFormValue(val)) {
      continue;
    }

    if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      const cleaned = stripEmptyForgeValues(val);
      if (cleaned != null && Object.keys(cleaned as object).length > 0) {
        result[key] = cleaned;
      }
    } else {
      result[key] = val;
    }
  }

  return result as T;
}

/**
 * Context service managing a ng-forge dynamic form's connection to the DbxForm system.
 *
 * Bridges ng-forge's signal-based form state to the existing DbxForm/DbxMutableForm
 * Observable-based interface. Simpler than DbxFormlyContext — no delegate pattern needed.
 */
@Injectable()
export class DbxForgeFormContext<T = unknown> implements DbxMutableForm<T>, OnDestroy {
  private static readonly INITIAL_STATE: DbxFormEvent = { isComplete: false, state: DbxFormState.INITIALIZING, status: 'PENDING' };

  readonly lockSet = new LockSet();

  /**
   * When true (default), {@link getValue} only emits values when the form is valid.
   * Set to false to emit all values regardless of validation state.
   */
  requireValid = true;

  /**
   * When true (default), keys starting with `_` are stripped from the form value
   * before it is emitted by {@link getValue}. These keys are layout artifacts from
   * ng-forge wrappers (sections, toggles, expand groups, rows) and are not part of
   * the domain model.
   *
   * Object values under `_` keys are unwrapped (contents merged into parent);
   * primitive `_` values (e.g. toggle booleans) are dropped entirely.
   */
  stripInternalKeys = true;

  /**
   * When true (default), keys whose values are empty (`null`, `undefined`, or `""`)
   * are stripped from the form value before emission. This normalizes ng-forge output
   * to match ngx-formly behavior, where the model only includes keys that have been
   * explicitly set by the user.
   *
   * Note: `false`, `0`, and empty arrays are NOT considered empty and are preserved.
   */
  stripEmptyValues = true;

  /**
   * When true (default), the form still reports `isComplete` based on validity even
   * while disabled. This matches the ngx-formly behavior where disabling a form only
   * locks inputs but does not suppress the form value.
   *
   * When false, `isComplete` is forced to `false` while disabled, preventing the
   * action system from reading the form value. `false` is the native ng-forge default
   * behavior, where a disabled form does not produce output.
   */
  emitValueWhenDisabled = true;

  /**
   * Tracks validity signals from nested wrapper forms (e.g. forgeFormFieldWrapper,
   * forgeDbxSectionFieldWrapper). These wrappers create isolated DynamicForm instances
   * whose validity is not visible to the parent DynamicForm.valid() signal.
   *
   * Wrapper components register their nested form's validity via {@link registerWrapperValidity},
   * and the combined result is exposed as {@link allWrappersValid}.
   */
  private readonly _wrapperValidSignals = new Set<Signal<boolean>>();
  private readonly _wrapperValidSignalsVersion = signal(0);

  /**
   * Computed signal that is `true` when all registered wrapper nested forms are valid.
   * Returns `true` when no wrappers are registered.
   */
  readonly allWrappersValid = computed(() => {
    this._wrapperValidSignalsVersion(); // depend on version to retrigger when wrappers register/unregister
    for (const s of this._wrapperValidSignals) {
      if (!s()) {
        return false;
      }
    }

    return true;
  });

  /**
   * Registers a wrapper's nested form validity signal for tracking.
   *
   * Call this from wrapper content components so that validation errors in nested
   * DynamicForm instances propagate to the parent form's validity state.
   *
   * @param valid - The wrapper's nested form validity signal.
   * @returns A cleanup function that unregisters the signal. Call on component destroy.
   */
  registerWrapperValidity(valid: Signal<boolean>): () => void {
    this._wrapperValidSignals.add(valid);
    this._wrapperValidSignalsVersion.update((v) => v + 1);

    return () => {
      this._wrapperValidSignals.delete(valid);
      this._wrapperValidSignalsVersion.update((v) => v + 1);
    };
  }

  private readonly _config = new BehaviorSubject<Maybe<FormConfig>>(undefined);
  private readonly _disabled = new BehaviorSubject<BooleanStringKeyArray>(undefined);
  private readonly _formState = new BehaviorSubject<DbxFormEvent>(DbxForgeFormContext.INITIAL_STATE);
  private readonly _value = new BehaviorSubject<Maybe<T>>(undefined);
  private readonly _isValid = new BehaviorSubject<boolean>(false);
  private readonly _setValue = new BehaviorSubject<Maybe<Partial<T>>>(undefined);
  private readonly _reset = new BehaviorSubject<Date>(new Date());

  readonly config$ = this._config.pipe(filterMaybe(), shareReplay(1));

  /**
   * Form event stream that restarts on each reset, mirroring the formly form's
   * switchMap-on-reset pattern. This ensures that each resetForm() produces a fresh
   * emission sequence, so dbxFormSource's distinctUntilChanged on state can detect
   * the RESET transition even if the previous state was also RESET.
   */
  readonly stream$: Observable<DbxFormEvent> = this._reset.pipe(
    switchMap(() => this._formState.asObservable()),
    shareReplay(1)
  );

  readonly setValue$ = this._setValue.asObservable();
  readonly disabled$ = this._disabled.asObservable();
  readonly reset$ = this._reset.asObservable();

  set config(config: Maybe<FormConfig>) {
    this._config.next(config);
  }

  get config(): Maybe<FormConfig> {
    return this._config.value;
  }

  updateFormState(state: DbxFormEvent): void {
    this._formState.next(state);
  }

  updateValue(value: T): void {
    let cleaned = this.stripInternalKeys ? stripForgeInternalKeys(value) : value;
    cleaned = this.stripEmptyValues ? stripEmptyForgeValues(cleaned) : cleaned;
    this._value.next(cleaned);
  }

  updateIsValid(valid: boolean): void {
    this._isValid.next(valid);
  }

  getValue(): Observable<T> {
    if (this.requireValid) {
      return combineLatest([this._value.pipe(filterMaybe()), this._isValid]).pipe(
        filter(([, valid]) => valid),
        map(([value]) => value)
      );
    }

    return this._value.pipe(filterMaybe());
  }

  getDisabled(): Observable<BooleanStringKeyArray> {
    return this._disabled.asObservable();
  }

  setValue(value: Maybe<Partial<T>>): void {
    this._setValue.next(value);
  }

  resetForm(): void {
    this._reset.next(new Date());
  }

  setDisabled(key?: DbxFormDisabledKey, disabled = true): void {
    const next = BooleanStringKeyArrayUtility.set(this._disabled.value, key ?? DEFAULT_FORM_DISABLED_KEY, disabled);
    this._disabled.next(next);
  }

  forceFormUpdate(): void {
    // Signal forms update automatically — this is a no-op for forge
  }

  ngOnDestroy(): void {
    this.lockSet.destroyOnNextUnlock(() => {
      this._config.complete();
      this._disabled.complete();
      this._formState.complete();
      this._value.complete();
      this._isValid.complete();
      this._setValue.complete();
      this._reset.complete();
    });
  }
}

/**
 * Provides DbxForgeFormContext and registers it as both DbxForm and DbxMutableForm.
 */
export function provideDbxForgeFormContext(): Provider[] {
  return [DbxForgeFormContext, ...provideDbxMutableForm(DbxForgeFormContext)];
}
