import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';

/**
 * Unique key used to identify and coordinate popover instances.
 */
export type DbxPopoverKey = string;

/**
 * Abstract controller for managing a popover's lifecycle, providing access to its data and close/return operations.
 */
export abstract class DbxPopoverController<O = unknown, I = unknown> {
  abstract readonly key: DbxPopoverKey;
  abstract readonly data?: Maybe<I>;
  abstract readonly closing$: Observable<boolean>;
  /**
   * Signals for the popover to close.
   */
  abstract close(): void;
  /**
   * Closes the popover and returns the input value.
   */
  abstract return(value?: O): void;
}
