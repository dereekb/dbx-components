import { Injectable, OnDestroy, Provider } from '@angular/core';
import { BehaviorSubject, Observable, of, switchMap, shareReplay, distinctUntilChanged } from 'rxjs';
import { DbxForm, DbxFormDisabledKey, DbxFormEvent, DbxFormState, DbxMutableForm, DEFAULT_FORM_DISABLED_KEY, provideDbxMutableForm } from '../form/form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { LockSet, filterMaybe, tapLog } from '@dereekb/rxjs';
import { BooleanStringKeyArray, BooleanStringKeyArrayUtility, Destroyable, type Maybe } from '@dereekb/util';

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
  return [DbxFormlyContext, ...provideDbxMutableForm(DbxFormlyContext)];
}

/**
 * DbxForm Instance that registers a delegate and manages the state of that form/delegate.
 */
@Injectable()
export class DbxFormlyContext<T = unknown> implements DbxForm<T>, Destroyable, OnDestroy {
  private static INITIAL_STATE: DbxFormEvent = { isComplete: false, state: DbxFormState.INITIALIZING, status: 'PENDING' };

  readonly lockSet = new LockSet();

  private readonly _fields = new BehaviorSubject<Maybe<FormlyFieldConfig[]>>(undefined);
  private readonly _initialValue = new BehaviorSubject<Maybe<Partial<T>>>(undefined);
  private readonly _disabled = new BehaviorSubject<BooleanStringKeyArray>(undefined);
  private readonly _delegate = new BehaviorSubject<Maybe<DbxFormlyContextDelegate<T>>>(undefined);

  readonly fields$ = this._fields.pipe(filterMaybe(), shareReplay(1));
  readonly disabled$ = this._disabled.pipe(filterMaybe(), shareReplay(1));
  readonly stream$: Observable<DbxFormEvent> = this._delegate.pipe(
    distinctUntilChanged(),
    switchMap((x) => (x ? x.stream$ : of(DbxFormlyContext.INITIAL_STATE))),
    shareReplay(1)
  );

  ngOnDestroy(): void {
    this.destroy();
  }

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
          initialDisabled: this.disabled,
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
    return this._delegate.pipe(
      filterMaybe(),
      switchMap((x) => x.getValue()),
      shareReplay(1)
    );
  }

  setValue(value: Partial<T>): void {
    this._initialValue.next(value);

    if (this._delegate.value) {
      this._delegate.value.setValue(value);
    }
  }

  isDisabled(): boolean {
    return BooleanStringKeyArrayUtility.isTrue(this.disabled);
  }

  get disabled(): BooleanStringKeyArray {
    return this._disabled.value;
  }

  getDisabled(): Observable<BooleanStringKeyArray> {
    return this._disabled.asObservable();
  }

  setDisabled(key?: DbxFormDisabledKey, disabled = true): void {
    const nextDisabled = BooleanStringKeyArrayUtility.set(this.disabled, key ?? DEFAULT_FORM_DISABLED_KEY, disabled);
    this._disabled.next(nextDisabled);

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
