import { inject, Injectable, InjectionToken } from '@angular/core';

/**
 * Corresponds to the enabled value on the DbxFirebaseDevelopmentService.
 */
export const DEFAULT_FIREBASE_DEVELOPMENT_ENABLED_TOKEN = new InjectionToken('DefaultDbxFirebaseDevelopmentEnabled');

/**
 * Service used for registering widgets used for development.
 *
 * Default providers can be configured by the DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN injectable value.
 */
@Injectable()
export class DbxFirebaseDevelopmentService {
  readonly enabled = inject<boolean>(DEFAULT_FIREBASE_DEVELOPMENT_ENABLED_TOKEN, { optional: true }) ?? false;
}
