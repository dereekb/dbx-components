import { forwardRef, Provider, Type } from '@angular/core';
import { Observable } from 'rxjs';
import { LockSet } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';

/**
 * Current state of a DbxForm
 */
export enum DbxFormState {
  INITIALIZING = -1,
  RESET = 0,
  USED = 1
}

/**
 * DbxForm stream event
 */
export interface DbxFormEvent {
  readonly isComplete: boolean;
  readonly state: DbxFormState;
  readonly pristine?: boolean;
  readonly untouched?: boolean;
  readonly lastResetAt?: Date;
  readonly changesCount?: number;
  readonly isDisabled?: boolean;
}

/**
 * Form that has an event stream, value, and state items.
 */
export abstract class DbxForm<T = any> {
  abstract readonly stream$: Observable<DbxFormEvent>;

  /**
   * Returns an observable that returns the current state of the form.
   */
  abstract getValue(): Observable<T>;
}

export abstract class DbxMutableForm<T = any> extends DbxForm<T> {
  /**
   * LockSet for the form.
   */
  abstract readonly lockSet?: LockSet;
  /**
   * Sets the initial value of the form, and resets the form.
   * 
   * @param value 
   */
  abstract setValue(value: Maybe<Partial<T>>): void;

  /**
   * Resets the form to the initial value.
   */
  abstract resetForm(): void;

  /**
   * Sets the form's disabled state.
   * 
   * @param disabled 
   */
  abstract setDisabled(disabled?: boolean): void;

  /**
   * Force the form to update itself as if it was changed.
   */
  abstract forceFormUpdate(): void;
}

export function ProvideDbxForm<S extends DbxForm>(sourceType: Type<S>): Provider[] {
  return [{ provide: DbxForm, useExisting: forwardRef(() => sourceType) }];
}

export function ProvideDbxMutableForm<S extends DbxMutableForm>(sourceType: Type<S>): Provider[] {
  return [
    ...ProvideDbxForm(sourceType),
    { provide: DbxMutableForm, useExisting: forwardRef(() => sourceType) }
  ];
}
