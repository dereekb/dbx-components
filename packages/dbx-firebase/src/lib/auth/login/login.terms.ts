import { InjectionToken } from '@angular/core';

/**
 * Configuration interface for DbxFirebaseLoginTermsSimpleComponent.
 */
export interface DbxFirebaseLoginTermsOfServiceUrlsConfig {
  /**
   * The Terms of Service URL.
   */
  readonly tosUrl: string;
  /**
   * The Privacy Policy URL.
   */
  readonly privacyUrl: string;
}

/**
 * Injection token for DbxFirebaseLoginTermsOfServiceUrlsConfig.
 */
export const DBX_FIREBASE_LOGIN_TERMS_OF_SERVICE_URLS_CONFIG = new InjectionToken<DbxFirebaseLoginTermsOfServiceUrlsConfig>('DBX_FIREBASE_LOGIN_TERMS_OF_SERVICE_URLS_CONFIG');
