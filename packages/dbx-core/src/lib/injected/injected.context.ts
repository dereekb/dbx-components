import { Provider, Type } from "@angular/core";
import { DbxInjectionComponentConfig } from "./injected";

/**
 * DbxInjectedViewContext showContext() configuration.
 */
export interface DbxInjectionContextConfig<T = any, O = any> {
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
  abstract showContext<T = any, O = any>(config: DbxInjectionContextConfig<T>): Promise<O>;

}

/**
 * Allows a directive to provide a formly context and form.
 */
export function ProvideDbxInjectionContext<T>(type: Type<T>): Provider[] {
  return [{
    provide: DbxInjectionContext,
    useExisting: type
  }];
}
