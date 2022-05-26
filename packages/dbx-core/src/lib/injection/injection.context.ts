import { Provider, Type } from '@angular/core';
import { DbxInjectionComponentConfig } from './injection';

/**
 * DbxInjectedViewContext showContext() configuration.
 */
export interface DbxInjectionContextConfig<T = unknown, O = unknown> {
  /**
   * Injected config.
   */
  config: DbxInjectionComponentConfig<T>;
  /**
   * Promise used to retrieve data from the given instance.
   */
  use: (instance: T) => Promise<O>;
}

/**
 * View that can switch to show another arbitrary view, then switch back when the promise ends.
 *
 * It is similar to *ngIf/*ngSwitch, but the original child content is retained instead of discarded,
 * and returns once the special context is done being used.
 */
export abstract class DbxInjectionContext {
  /**
   * Shows the given context until the promise ends, then displays the original content.
   *
   * The original content is hidden instead of removed from the context to avoid destruction of children elements.
   */
  abstract showContext<T = unknown, O = unknown>(config: DbxInjectionContextConfig<T>): Promise<O>;

  /**
   * Bails out of any current promise, if one is set.
   *
   * Returns true if the bail signal has been sent.
   */
  abstract resetContext(): boolean;
}

/**
 * Allows a directive to provide a formly context and form.
 */
export function provideDbxInjectionContext<T extends DbxInjectionContext>(type: Type<T>): Provider[] {
  return [
    {
      provide: DbxInjectionContext,
      useExisting: type
    }
  ];
}
