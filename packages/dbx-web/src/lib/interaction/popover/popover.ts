import { Maybe } from "@dereekb/util";
import { Observable } from "rxjs";

export type DbNgxPopoverKey = string;

export abstract class DbNgxPopoverController<I = any, O = any> {
  abstract readonly key: DbNgxPopoverKey;
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
