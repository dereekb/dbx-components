import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';

/**
 * Unique key used to identify and coordinate popup instances.
 */
export type DbxPopupKey = string;

/**
 * Possible window states for a popup: normal, minimized, or fullscreen.
 */
export const DbxPopupWindowState = {
  NORMAL: 'normal' as const,
  MINIMIZED: 'minimized' as const,
  FULLSCREEN: 'fullscreen' as const
} as const;

/**
 * Union type of all possible popup window state values.
 */
export type DbxPopupWindowStateType = (typeof DbxPopupWindowState)[keyof typeof DbxPopupWindowState];

/**
 * Abstract controller for managing a popup's lifecycle, providing close, return, minimize, fullscreen, and normalscreen operations.
 */
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
