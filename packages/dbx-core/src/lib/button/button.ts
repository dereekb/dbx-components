import { Type, Provider } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { Observable } from 'rxjs';

/**
 * Used for intercepting button click events.
 *
 * Can be used to delay/modify trigger/click behaviors.
 */
export interface DbNgxButtonInterceptor {
  /**
   * Handles a button click event. Returns an observable that will say whether or not to continue the click event.
   */
  interceptButtonClick: () => Observable<boolean>;
}

export abstract class DbNgxButton {
  abstract disabled$: Observable<boolean>;
  abstract working$: Observable<boolean>;
  abstract disabled: Maybe<boolean>;
  abstract working: Maybe<boolean>;
  abstract icon?: string;
  abstract text?: string;
  abstract clicked$: Observable<any>;
  abstract setButtonInterceptor(interceptor: DbNgxButtonInterceptor): void;
  abstract clickButton(): void;
}

export function ProvideDbNgxButton<S extends DbNgxButton>(sourceType: Type<S>): Provider[] {
  return [{
    provide: DbNgxButton,
    useExisting: sourceType
  }];
}
