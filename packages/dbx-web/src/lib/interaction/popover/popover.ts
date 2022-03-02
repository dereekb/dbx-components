import { Maybe } from "@dereekb/util";
import { Observable } from "rxjs";

export type DbxPopoverKey = string;

export abstract class DbxPopoverController<O = any, I = any> {
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
