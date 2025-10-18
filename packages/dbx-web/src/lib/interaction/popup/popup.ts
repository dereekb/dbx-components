import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';

export type DbxPopupKey = string;

export const DbxPopupWindowState = {
  NORMAL: 'normal' as const,
  MINIMIZED: 'minimized' as const,
  FULLSCREEN: 'fullscreen' as const
} as const;

export type DbxPopupWindowStateType = (typeof DbxPopupWindowState)[keyof typeof DbxPopupWindowState];

export abstract class DbxPopupController<O = unknown, I = unknown> {
  abstract readonly key: DbxPopupKey;
  abstract readonly data?: Maybe<I>;
  abstract readonly windowState$: Observable<DbxPopupWindowStateType>;
  abstract readonly closing$: Observable<boolean>;
  /**
   * Signals for the popup to close.
   */
  abstract close(): void;
  /**
   * Closes the popup and returns the input value.
   */
  abstract return(value?: O): void;
  abstract minimize(): void;
  abstract normalscreen(): void;
  abstract fullscreen(): void;
}
