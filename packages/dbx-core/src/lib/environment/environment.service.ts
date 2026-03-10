import { Injectable, inject } from '@angular/core';
import { DbxAppEnviroment } from './environment';

/**
 * Injectable service providing convenience accessors for the application's {@link DbxAppEnviroment}.
 *
 * Exposes computed properties for common environment checks (production, staging, testing)
 * and a typed getter for accessing custom environment properties.
 *
 * @example
 * ```typescript
 * @Component({ ... })
 * export class MyComponent {
 *   private readonly envService = inject(DbxAppEnviromentService);
 *
 *   get showDebugPanel(): boolean {
 *     return !this.envService.isProduction;
 *   }
 * }
 * ```
 */
@Injectable()
export class DbxAppEnviromentService {
  readonly environment = inject(DbxAppEnviroment);

  get isProduction() {
    return this.environment.production === true;
  }

  get isStaging() {
    return this.environment.staging ?? false;
  }

  get isTesting() {
    return this.environment.testing ?? !this.environment.production;
  }

  /**
   * Returns the environment, typed as a specific type.
   */
  getEnvironment<T extends DbxAppEnviroment>(): T {
    return this.environment as T;
  }
}
