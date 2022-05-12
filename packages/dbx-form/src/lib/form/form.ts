import { forwardRef, Provider, Type } from '@angular/core';
import { Observable } from 'rxjs';
import { LockSet } from '@dereekb/rxjs';
import { BooleanStringKeyArray, Maybe } from '@dereekb/util';
import { FormControlStatus } from '@angular/forms';

/**
 * Current state of a DbxForm
 */
export enum DbxFormState {
  /**
   * Form is not finished initializing.
   */
  INITIALIZING = -1,
  /**
   * Form is initialized but has not yet used.
   */
  RESET = 0,
  /**
   * Form has been used.
   */
  USED = 1
}


/**
 * Unique key for disabling/enabling.
 */
export type DbxFormDisabledKey = string;

export const DEFAULT_FORM_DISABLED_KEY = 'dbx_form_disabled';

/**
 * DbxForm stream event
 */
export interface DbxFormEvent {
  readonly isComplete: boolean;
  readonly state: DbxFormState;
  readonly status: FormControlStatus;
  readonly pristine?: boolean;
  readonly untouched?: boolean;
  readonly lastResetAt?: Date;
  readonly changesCount?: number;
  /**
   * Whether or not the form is disabled.
   */
  readonly isDisabled?: boolean;
  /**
   * Current disabled state keys.
   */
  readonly disabled?: BooleanStringKeyArray;
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

  /**
   * Returns an observable that returns the current disabled keys.
   */
  abstract getDisabled(): Observable<BooleanStringKeyArray>;
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
   * Disables the form
   * 
   * @param disabled 
   */
  abstract setDisabled(key?: DbxFormDisabledKey, disabled?: boolean): void;

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
