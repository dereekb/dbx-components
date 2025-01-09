import { Injectable, inject } from '@angular/core';
import { DbxAppEnviroment } from './environment';

/**
 * Service for accessing the app's environment details.
 */
@Injectable({
  providedIn: 'root'
})
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
