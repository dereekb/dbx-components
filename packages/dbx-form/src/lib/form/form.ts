import { forwardRef, type Provider, type Type } from '@angular/core';
import { type Observable } from 'rxjs';
import { type LockSet } from '@dereekb/rxjs';
import { type BooleanStringKeyArray, type Maybe } from '@dereekb/util';
import { type AbstractControl, type FormControlStatus } from '@angular/forms';

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

/**
 * Default key used when disabling/enabling a form without specifying a custom key.
 */
export const DEFAULT_FORM_DISABLED_KEY = 'dbx_form_disabled';

/**
 * Reference to the current state of a form.
 */
export interface DbxFormStateRef {
  readonly state: DbxFormState;
}

/**
 * DbxForm stream event
 */
export interface DbxFormEvent extends DbxFormStateRef {
  readonly isComplete: boolean;
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
export abstract class DbxForm<T = unknown> {
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

/**
 * Mutable extension of {@link DbxForm} that supports setting values, resetting, and disabling the form.
 *
 * @typeParam T - The form value type.
 */
export abstract class DbxMutableForm<T = unknown> extends DbxForm<T> {
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

/**
 * Provides the given type as a {@link DbxForm} in Angular's dependency injection system.
 *
 * @param sourceType - The concrete form type to register as a provider.
 * @returns An array of Angular providers.
 */
export function provideDbxForm<S extends DbxForm>(sourceType: Type<S>): Provider[] {
  return [{ provide: DbxForm, useExisting: forwardRef(() => sourceType) }];
}

/**
 * Provides the given type as both a {@link DbxForm} and {@link DbxMutableForm} in Angular's dependency injection system.
 *
 * @param sourceType - The concrete mutable form type to register as a provider.
 * @returns An array of Angular providers.
 */
export function provideDbxMutableForm<S extends DbxMutableForm>(sourceType: Type<S>): Provider[] {
  return [...provideDbxForm(sourceType), { provide: DbxMutableForm, useExisting: forwardRef(() => sourceType) }];
}

/**
 * Enables or disables an Angular form control based on the provided flag.
 *
 * @param form - The Angular abstract control to enable or disable.
 * @param isDisabled - Whether to disable (`true`) or enable (`false`) the control.
 * @param config - Optional configuration passed to the control's `disable()` or `enable()` methods.
 */
export function toggleDisableFormControl(form: AbstractControl<any>, isDisabled: boolean, config?: Parameters<AbstractControl['disable']>[0]) {
  if (isDisabled) {
    form.disable(config);
  } else {
    form.enable(config);
  }
}
