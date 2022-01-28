import { Maybe } from '@dereekb/util';
import { Observable } from 'rxjs';

export type DbNgxPopupKey = string;

export enum DbNgxPopupWindowState {
  NORMAL = 'normal',
  MINIMIZED = 'minimized',
  FULLSCREEN = 'fullscreen'
}

export abstract class DbNgxPopupController<I = any, O = any> {
  abstract readonly key: DbNgxPopupKey;
  abstract readonly data?: Maybe<I>;
  abstract readonly windowState$: Observable<DbNgxPopupWindowState>;
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
