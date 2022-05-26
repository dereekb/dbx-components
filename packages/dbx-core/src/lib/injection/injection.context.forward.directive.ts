import { Directive, Host } from '@angular/core';
import { DbxInjectionContext, DbxInjectionContextConfig } from './injection.context';

/**
 * Abstract DbxInjectionContext implementation that forwards commands to a host DbxInjectionContext.
 *
 * This abstract type is used by related types for dependency injection purposes, so that those types
 * can be injected instead of just any DbxInjectionContext.
 */
@Directive()
export abstract class AbstractForwardDbxInjectionContextDirective implements DbxInjectionContext {
  constructor(@Host() readonly dbxInjectionContext: DbxInjectionContext) {}

  // MARK: DbxInjectionContext
  showContext<T = unknown, O = unknown>(config: DbxInjectionContextConfig<T, unknown>): Promise<O> {
    return this.dbxInjectionContext.showContext(config);
  }

  resetContext(): boolean {
    return this.dbxInjectionContext.resetContext();
  }
}
