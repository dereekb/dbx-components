import { Maybe } from '@dereekb/util';
import { Observable } from 'rxjs';

export type DbxPopupKey = string;

export enum DbxPopupWindowState {
  NORMAL = 'normal',
  MINIMIZED = 'minimized',
  FULLSCREEN = 'fullscreen'
}

export abstract class DbxPopupController<O = any, I = any> {
  abstract readonly key: DbxPopupKey;
  abstract readonly data?: Maybe<I>;
  abstract readonly windowState$: Observable<DbxPopupWindowState>;
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
