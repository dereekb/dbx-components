import { base, type DemoEnvironment } from './base';

/**
 * Production environment configuration.
 *
 * @dbxAllowConstantName Angular environment files conventionally export camelCase singletons.
 */
export const environment: DemoEnvironment = {
  ...base,
  production: true,
  firebase: {
    ...base.firebase,
    emulators: {
      useEmulators: false
    }
  },
  mapbox: {
    token: 'pk.eyJ1IjoiZGVyZWVrYiIsImEiOiJjbDZ0bmliZTExcTByM2lycWU0a2FxNWZmIn0.PT1rSJQKOjNIYAwDTEdJ7w'
  },
  oidc: {
    // the issuer is deployed here so cookies are set on the API host directly, bypassing the
    // Firebase Hosting cookie strip at components.dereekb.com
    apiOrigin: 'https://api.components.dereekb.com'
  },
  externalConnections: {
    // the app and the API share an origin in production, so the authorize paths stay relative
    authorizeOrigin: undefined
  }
};
