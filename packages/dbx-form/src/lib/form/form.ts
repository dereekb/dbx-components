import { Provider, Type } from '@angular/core';
import { Observable } from 'rxjs';
import { LockSet } from '@dereekb/rxjs';

/**
 * Current state of a DbxForm
 */
export enum DbxFormState {
  INITIALIZING = -1,
  INCOMPLETE = 0,
  COMPLETE = 1,
  RESET = 2
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
}

/**
 * Form that has an event stream, value, and state items.
 */
export abstract class DbxForm {
  /**
   * LockSet for the form.
   */
  abstract readonly lockSet: LockSet;
  /**
   * True if the form is complete/valid.
   */
  abstract readonly isComplete: boolean;
  abstract readonly state: DbxFormState;
  abstract readonly stream$: Observable<DbxFormEvent>;
  abstract readonly value: any;
  abstract setValue(value: any): void;
  abstract resetForm(): void;
  abstract forceFormUpdate(): void;
}

/**
 * A typed DbxForm
 */
export interface TypedDbxForm<T> extends DbxForm {
  readonly value: T;
  setValue(value: T): void;
  resetForm(): void;
}

export function ProvideDbxForm<S extends DbxForm>(sourceType: Type<S>): Provider[] {
  return [{ provide: DbxForm, useExisting: sourceType }];
}
