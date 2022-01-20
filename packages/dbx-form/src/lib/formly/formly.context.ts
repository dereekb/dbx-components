import { Provider, Type } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { DbNgxForm, DbNgxFormEvent, DbNgxFormState, TypedDbNgxForm } from '../form/form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { mergeMap } from 'rxjs/operators';
import { LockSet } from '@dereekb/util-rxjs';
import { Maybe } from '@dereekb/util';

/**
 * DbNgxFormlyContext delegate.
 * 
 * This is usually the component or element that contains the form itself.
 */
export interface DbNgxFormlyContextDelegate<T = any> {
  readonly isComplete: boolean;
  readonly state: DbNgxFormState;
  readonly stream$: Observable<DbNgxFormEvent>;
  setFields(fields: Maybe<FormlyFieldConfig[]>): void;
  getValue(): T;
  setValue(value: Maybe<Partial<T>>): void;
  resetForm(): void;
  forceFormUpdate(): void;
  isDisabled(): boolean;
  setDisabled(disabled?: boolean): void;
}

/**
 * Allows a directive to provide a formly context and form.
 */
export function ProvideFormlyContext(): Provider[] {
  return [{
    provide: DbNgxFormlyContext,
    useClass: DbNgxFormlyContext
  }, {
    provide: DbNgxForm,
    useExisting: DbNgxFormlyContext
  }];
}

/**
 * DbNgxForm Instance that registers a delegate and manages the state of that form/delegate.
 */
export class DbNgxFormlyContext<T> implements TypedDbNgxForm<T> {

  readonly lockSet = new LockSet();

  private static INITIAL_STATE = { isComplete: false, state: DbNgxFormState.INITIALIZING };

  private static EMPTY_DELEGATE: DbNgxFormlyContextDelegate<any> = {
    isComplete: false,
    state: DbNgxFormState.INITIALIZING,
    stream$: of(DbNgxFormlyContext.INITIAL_STATE),
    setFields(fields: FormlyFieldConfig[]): void {
      // Do nothing.
    },
    getValue(): any {
      return undefined;
    },
    setValue(value: any): void {
      // Do nothing.
    },
    resetForm(): void {
      // Do nothing.
    },
    forceFormUpdate(): void {
      // Do nothing.
    },
    isDisabled(): boolean {
      return false;
    },
    setDisabled(disabled?: boolean): void {
      // Do nothing.
    }
  };

  private _fields?: Maybe<FormlyFieldConfig[]>;
  private _initialValue?: Maybe<Partial<T>>;
  private _disabled: boolean = false;

  private _delegate: DbNgxFormlyContextDelegate<T> = DbNgxFormlyContext.EMPTY_DELEGATE;
  private _streamSubject = new BehaviorSubject<Observable<DbNgxFormEvent>>(of(DbNgxFormlyContext.INITIAL_STATE));
  private _stream$ = this._streamSubject.pipe(mergeMap((stream) => stream));

  constructor() { }

  destroy(): void {
    this._streamSubject.complete();
  }

  get isDestroyed(): boolean {
    return this._streamSubject.isStopped;
  }

  setDelegate(delegate?: DbNgxFormlyContextDelegate<T>): void {
    this._delegate = delegate ?? DbNgxFormlyContext.EMPTY_DELEGATE;
    this._streamSubject.next(this._delegate.stream$);
    this._delegate.setFields(this._fields);
    this._delegate.setValue(this._initialValue);
    this._delegate.setDisabled(this._disabled);
  }

  clearDelegate(delegate: DbNgxFormlyContextDelegate<T>): void {
    if (this._delegate === delegate && !this.isDestroyed) {
      this.setDelegate(undefined);
    }
  }

  get fields(): Maybe<FormlyFieldConfig[]> {
    return this._fields;
  }

  set fields(fields: Maybe<FormlyFieldConfig[]>) {
    this._fields = fields;
    this._delegate.setFields(this._fields);
  }

  // MARK: FormComponent
  get isComplete(): boolean {
    return this._delegate.isComplete;
  }

  get state(): DbNgxFormState {
    return this._delegate.state;
  }

  get stream$(): Observable<DbNgxFormEvent> {
    return this._stream$;
  }

  get value(): T {
    return this._delegate.getValue();
  }

  setValue(value: Partial<T>): void {
    this._initialValue = value;
    this._delegate.setValue(value);
  }

  isDisabled(): boolean {
    return this._delegate.isDisabled();
  }

  setDisabled(disabled = true): void {
    this._disabled = disabled;
    this._delegate.setDisabled(disabled);
  }

  resetForm(): void {
    this._delegate.resetForm();
  }

  forceFormUpdate(): void {
    this._delegate.forceFormUpdate();
  }

}
