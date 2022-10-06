import { Inject, Injectable, InjectionToken, Optional } from '@angular/core';

/**
 * Enabled state
 */
export const DEFAULT_FIREBASE_DEVELOPMENT_ENABLED_TOKEN = new InjectionToken('DefaultDbxFirebaseDevelopmentEnabled');

/**
 * Service used for registering widgets used for development.
 *
 * Default providers can be configured by the DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN injectable value.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxFirebaseDevelopmentService {
  constructor(@Optional() @Inject(DEFAULT_FIREBASE_DEVELOPMENT_ENABLED_TOKEN) readonly enabled: boolean) {}
}
