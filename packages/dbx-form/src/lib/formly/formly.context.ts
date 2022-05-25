import { Provider } from '@angular/core';
import { BehaviorSubject, Observable, of, switchMap, shareReplay, distinctUntilChanged } from 'rxjs';
import { DbxForm, DbxFormDisabledKey, DbxFormEvent, DbxFormState, DbxMutableForm, DEFAULT_FORM_DISABLED_KEY, provideDbxMutableForm } from '../form/form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { LockSet, filterMaybe } from '@dereekb/rxjs';
import { BooleanStringKeyArray, BooleanStringKeyArrayUtilityInstance, Maybe } from '@dereekb/util';

export interface DbxFormlyInitialize<T> {
  fields: Observable<FormlyFieldConfig[]>;
  initialDisabled: BooleanStringKeyArray;
  initialValue: Maybe<Partial<T>>;
}

/**
 * DbxFormlyContext delegate.
 * 
 * This is usually the component or element that contains the form itself.
 */
export interface DbxFormlyContextDelegate<T = unknown> extends Omit<DbxMutableForm<T>, 'lockSet'> {
  readonly stream$: Observable<DbxFormEvent>;
  init(initialize: DbxFormlyInitialize<T>): void;
}

/**
 * Allows a directive to provide a formly context and form.
 */
export function provideFormlyContext(): Provider[] {
  return [{
    provide: DbxFormlyContext,
    useClass: DbxFormlyContext
  },
  ...provideDbxMutableForm(DbxFormlyContext)];
}

/**
 * DbxForm Instance that registers a delegate and manages the state of that form/delegate.
 */
export class DbxFormlyContext<T = unknown> implements DbxForm<T> {

  private static INITIAL_STATE: DbxFormEvent = { isComplete: false, state: DbxFormState.INITIALIZING, status: 'PENDING' };

  readonly lockSet = new LockSet();

  private _fields = new BehaviorSubject<Maybe<FormlyFieldConfig[]>>(undefined);
  private _initialValue = new BehaviorSubject<Maybe<Partial<T>>>(undefined);
  private _disabled = new BehaviorSubject<BooleanStringKeyArray>(undefined);
  private _delegate = new BehaviorSubject<Maybe<DbxFormlyContextDelegate<T>>>(undefined);

  readonly fields$ = this._fields.pipe(filterMaybe());
  readonly disabled$ = this._disabled.pipe(filterMaybe());
  readonly stream$: Observable<DbxFormEvent> = this._delegate.pipe(distinctUntilChanged(), switchMap(x => (x) ? x.stream$ : of(DbxFormlyContext.INITIAL_STATE)), shareReplay(1));

  destroy(): void {
    this.lockSet.destroyOnNextUnlock(() => {
      this._fields.complete();
      this._initialValue.complete();
      this._disabled.complete();
      this._delegate.complete();
    });
  }

  setDelegate(delegate?: DbxFormlyContextDelegate<T>): void {
    if (delegate !== this._delegate.value) {

      if (delegate != null) {
        delegate.init({
          fields: this.fields$,
          initialDisabled: this._disabled.value,
          initialValue: this._initialValue.value
        });
      }

      this._delegate.next(delegate);
    }
  }

  clearDelegate(delegate: DbxFormlyContextDelegate<T>): void {
    if (delegate === this._delegate.value) {
      this.setDelegate(undefined);
    }
  }

  get fields(): Maybe<FormlyFieldConfig[]> {
    return this._fields.value;
  }

  set fields(fields: Maybe<FormlyFieldConfig[]>) {
    this._fields.next(fields);
  }

  // MARK: FormComponent
  getValue(): Observable<T> {
    return this._delegate.pipe(filterMaybe(), switchMap(x => x.getValue()), shareReplay(1));
  }

  setValue(value: Partial<T>): void {
    this._initialValue.next(value);

    if (this._delegate.value) {
      this._delegate.value.setValue(value);
    }
  }

  isDisabled(): boolean {
    return BooleanStringKeyArrayUtilityInstance.isTrue(this.disabled);
  }

  get disabled(): BooleanStringKeyArray {
    return this._disabled.value;
  }

  getDisabled(): Observable<BooleanStringKeyArray> {
    return this._disabled.asObservable();
  }

  setDisabled(key?: DbxFormDisabledKey, disabled = true): void {
    this._disabled.next(BooleanStringKeyArrayUtilityInstance.set(this.disabled, key ?? DEFAULT_FORM_DISABLED_KEY, disabled));

    if (this._delegate.value) {
      this._delegate.value.setDisabled(key, disabled);
    }
  }

  resetForm(): void {
    if (this._delegate.value) {
      this._delegate.value.resetForm();
    }
  }

  forceFormUpdate(): void {
    if (this._delegate.value) {
      this._delegate.value.forceFormUpdate();
    }
  }

}
