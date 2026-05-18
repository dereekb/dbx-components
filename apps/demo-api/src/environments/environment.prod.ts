import { type FirebaseServerEnvironmentConfig } from '@dereekb/firebase-server';

/**
 * Production server environment configuration.
 *
 * @dbxAllowConstantName Angular environment files conventionally export camelCase singletons.
 */
export const environment: FirebaseServerEnvironmentConfig = {
  production: true,
  appUrl: 'https://components.dereekb.com'
};
