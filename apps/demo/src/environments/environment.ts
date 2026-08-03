import { base, type DemoEnvironment } from './base';

/**
 * Local-development environment configuration.
 *
 * @dbxAllowConstantName Angular environment files conventionally export camelCase singletons.
 */
export const environment: DemoEnvironment = {
  ...base,
  production: false,
  testing: true,
  firebase: {
    ...base.firebase,
    enabledLoginMethods: true
  }
};

/**
 * Optional API origin used by the dbx-firebase OIDC provider when the OIDC issuer is hosted on
 * a different origin than the frontend. Local development is single-origin, so leave undefined.
 */
export const OIDC_API_ORIGIN: string | undefined = undefined;

/**
 * Origin the external-connection authorize paths are resolved against.
 *
 * Local development serves the app from `ng serve` on 9010, but the OAuth controller is behind the
 * Firebase Hosting emulator on 9901, so the connect redirect must cross to that origin.
 */
export const EXTERNAL_CONNECTION_AUTHORIZE_ORIGIN: string | undefined = 'http://localhost:9901';
