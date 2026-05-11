import { base, type DemoEnvironment } from './base';

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
  }
};

/**
 * Production OIDC issuer host. The dbx-firebase OIDC service prepends this origin to the
 * interaction + authorization endpoint paths so cookies are set on the API host directly,
 * bypassing the Firebase Hosting cookie strip at `components.dereekb.com`.
 */
export const oidcApiOrigin = 'https://api.components.dereekb.com';
