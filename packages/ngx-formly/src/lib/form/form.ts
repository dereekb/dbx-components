import { Provider, Type } from '@angular/core';
import { Observable } from 'rxjs';
import { LockSet } from '@dereekb/util-rxjs';

/**
 * Current state of a DbNgxForm
 */
export enum DbNgxFormState {
  INITIALIZING = -1,
  INCOMPLETE = 0,
  COMPLETE = 1,
  RESET = 2
}

/**
 * DbNgxForm stream event
 */
export interface DbNgxFormEvent {
  readonly isComplete: boolean;
  readonly state: DbNgxFormState;
  readonly pristine?: boolean;
  readonly untouched?: boolean;
  readonly lastResetAt?: Date;
  readonly changesCount?: number;
}

/**
 * Form that has an event stream, value, and state items.
 */
export abstract class DbNgxForm {
  /**
   * LockSet the form may have exposed.
   */
  readonly lockSet?: LockSet;
  /**
   * True if the form is complete/valid.
   */
  abstract readonly isComplete: boolean;
  abstract readonly state: DbNgxFormState;
  abstract readonly stream$: Observable<DbNgxFormEvent>;
  abstract readonly value: any;
  abstract setValue(value: any): void;
  abstract resetForm(): void;
  abstract forceFormUpdate(): void;
}

/**
 * A typed DbNgxForm
 */
export interface TypedDbNgxForm<T> extends DbNgxForm {
  readonly value: T;
  setValue(value: T): void;
  resetForm(): void;
}

export function ProvideDbNgxForm<S extends DbNgxForm>(sourceType: Type<S>): Provider[] {
  return [{ provide: DbNgxForm, useExisting: sourceType }];
}
