import { Provider, Type } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { FormComponent, FormComponentEvent, FormComponentState, TypedFormComponent } from './form.component';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { mergeMap } from 'rxjs/operators';
import { LockSet } from '../utility/lock';

export interface DbNgxFormlyDirectiveDelegate<T = any> {
  readonly isComplete: boolean;
  readonly state: FormComponentState;
  readonly stream$: Observable<FormComponentEvent>;
  setFields(fields: FormlyFieldConfig[]): void;
  getValue(): T;
  setValue(value: Partial<T>): void;
  resetForm(): void;
  forceFormUpdate(): void;
  isDisabled(): boolean;
  setDisabled(disabled?: boolean): void;
}

export function ProvideFormlyContext<S>(sourceType: Type<S>): Provider[] {
  return [{
    provide: DbNgxFormlyContext,
    useClass: DbNgxFormlyContext
  }, {
    provide: FormComponent,
    useExisting: DbNgxFormlyContext
  }];
}

/**
 * Context used in conjunction with an DbNgxFormlyComponent.
 */
export class DbNgxFormlyContext<T> implements TypedFormComponent<T> {

  readonly lockSet = new LockSet();

  private static INITIAL_STATE = { isComplete: false, state: FormComponentState.INITIALIZING };

  private static EMPTY_DELEGATE: DbNgxFormlyDirectiveDelegate<any> = {
    isComplete: false,
    state: FormComponentState.INITIALIZING,
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

  private _fields: FormlyFieldConfig[];
  private _initialValue: Partial<T>;
  private _disabled: boolean;

  private _delegate: DbNgxFormlyDirectiveDelegate<T> = DbNgxFormlyContext.EMPTY_DELEGATE;
  private _streamSubject = new BehaviorSubject<Observable<FormComponentEvent>>(of(DbNgxFormlyContext.INITIAL_STATE));
  private _stream$ = this._streamSubject.pipe(mergeMap((stream) => stream));

  constructor() { }

  destroy(): void {
    this._streamSubject.complete();
  }

  get isDestroyed(): boolean {
    return this._streamSubject.isStopped;
  }

  setDelegate(delegate?: DbNgxFormlyDirectiveDelegate<T>): void {
    this._delegate = delegate ?? DbNgxFormlyContext.EMPTY_DELEGATE;
    this._streamSubject.next(this._delegate.stream$);
    this._delegate.setFields(this._fields);
    this._delegate.setValue(this._initialValue);
    this._delegate.setDisabled(this._disabled);
  }

  clearDelegate(delegate: DbNgxFormlyDirectiveDelegate<T>): void {
    if (this._delegate === delegate && !this.isDestroyed) {
      this.setDelegate(undefined);
    }
  }

  get fields(): FormlyFieldConfig[] {
    return this._fields;
  }

  set fields(fields: FormlyFieldConfig[]) {
    this._fields = fields;
    this._delegate.setFields(this._fields);
  }

  // MARK: FormComponent
  get isComplete(): boolean {
    return this._delegate.isComplete;
  }

  get state(): FormComponentState {
    return this._delegate.state;
  }

  get stream$(): Observable<FormComponentEvent> {
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
