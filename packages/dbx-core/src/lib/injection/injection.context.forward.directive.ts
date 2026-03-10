import { Directive, inject } from '@angular/core';
import { DbxInjectionContext, type DbxInjectionContextConfig } from './injection.context';

/**
 * Abstract directive that delegates {@link DbxInjectionContext} operations to a host-level
 * `DbxInjectionContext` obtained via Angular's dependency injection (`{ host: true }`).
 *
 * This is useful for creating specialized injection context subtypes that can be injected
 * by their own token while still forwarding the actual show/reset behavior to a parent
 * {@link DbxInjectionContextDirective}.
 *
 * @example
 * ```typescript
 * @Directive({ providers: [{ provide: MySpecialContext, useExisting: MyForwardDirective }] })
 * class MyForwardDirective extends AbstractForwardDbxInjectionContextDirective {}
 * ```
 *
 * @see {@link DbxInjectionContext}
 * @see {@link DbxInjectionContextDirective}
 */
@Directive()
export abstract class AbstractForwardDbxInjectionContextDirective implements DbxInjectionContext {
  /**
   * The host-level {@link DbxInjectionContext} that all operations are forwarded to.
   */
  readonly dbxInjectionContext = inject(DbxInjectionContext, { host: true });

  // MARK: DbxInjectionContext
  /**
   * {@inheritDoc DbxInjectionContext.showContext}
   */
  showContext<T = unknown, O = unknown>(config: DbxInjectionContextConfig<T, unknown>): Promise<O> {
    return this.dbxInjectionContext.showContext(config);
  }

  /**
   * {@inheritDoc DbxInjectionContext.resetContext}
   */
  resetContext(): boolean {
    return this.dbxInjectionContext.resetContext();
  }
}
