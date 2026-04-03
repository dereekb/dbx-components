import { Injectable, type OnDestroy, type Provider } from '@angular/core';
import { BehaviorSubject, type Observable, shareReplay } from 'rxjs';
import { type DbxMutableForm, type DbxFormEvent, type DbxFormDisabledKey, DbxFormState, DEFAULT_FORM_DISABLED_KEY, provideDbxMutableForm } from '../../form/form';
import { type BooleanStringKeyArray, BooleanStringKeyArrayUtility, type Maybe } from '@dereekb/util';
import { LockSet, filterMaybe } from '@dereekb/rxjs';
import { type FormConfig } from '@ng-forge/dynamic-forms';

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

  private readonly _config = new BehaviorSubject<Maybe<FormConfig>>(undefined);
  private readonly _disabled = new BehaviorSubject<BooleanStringKeyArray>(undefined);
  private readonly _formState = new BehaviorSubject<DbxFormEvent>(DbxForgeFormContext.INITIAL_STATE);
  private readonly _value = new BehaviorSubject<Maybe<T>>(undefined);
  private readonly _setValue = new BehaviorSubject<Maybe<Partial<T>>>(undefined);
  private readonly _reset = new BehaviorSubject<Date>(new Date());

  readonly config$ = this._config.pipe(filterMaybe(), shareReplay(1));
  readonly stream$: Observable<DbxFormEvent> = this._formState.asObservable();
  readonly setValue$ = this._setValue.asObservable();
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
    this._value.next(value);
  }

  getValue(): Observable<T> {
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
