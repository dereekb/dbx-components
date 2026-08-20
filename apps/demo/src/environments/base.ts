// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import { type Maybe } from '@dereekb/util';
import { type DbxFirebaseEnvironmentOptions } from '@dereekb/dbx-firebase';
import { type DbxMapboxEnvironmentOptions } from '@dereekb/dbx-web/mapbox';
import { type DbxAppEnvironment } from '@dereekb/dbx-core';
import { DEMO_FIREBASE_CLIENT_CONFIG } from 'demo-firebase';
import firebaseInfo from '../../../../firebase.json';

/**
 * Where the app reaches the OIDC issuer, which is not always its own origin.
 */
export interface DemoOidcEnvironmentOptions {
  /**
   * Origin the OIDC interaction + authorization endpoint paths are resolved against.
   *
   * Set it when the issuer is hosted on a different origin than the frontend, so cookies are set on
   * that host directly rather than being stripped by Firebase Hosting. Leave undefined when the two
   * share an origin, which keeps the OIDC paths relative.
   */
  apiOrigin?: Maybe<string>;
}

/**
 * Where the app reaches its own OAuth controller for third-party connections.
 */
export interface DemoExternalConnectionsEnvironmentOptions {
  /**
   * Origin the external-connection authorize paths are resolved against.
   *
   * Set it when the controller is not served from the app's own origin. Leave undefined when they
   * share one, which keeps the authorize paths relative.
   */
  authorizeOrigin?: Maybe<string>;
}

export interface DemoEnvironment extends DbxAppEnvironment {
  production: boolean;
  testing: boolean;
  analytics: {
    segment: string;
  };
  firebase: DbxFirebaseEnvironmentOptions;
  mapbox: DbxMapboxEnvironmentOptions;
  oidc: DemoOidcEnvironmentOptions;
  externalConnections: DemoExternalConnectionsEnvironmentOptions;
}

/**
 * Shared base environment used by environment.ts / environment.prod.ts.
 *
 * @dbxAllowConstantName Angular environment files conventionally export camelCase singletons.
 */
export const base: DemoEnvironment = {
  production: false,
  testing: false,
  analytics: {
    segment: '0GAAlnvz7dqWk5N6t3Cw89Ep6N1G1MQM'
  },
  firebase: {
    enabledLoginMethods: ['email', 'google', 'github'],
    // apiKey / authDomain / projectId / appId come from demo-firebase so the app, demo-api's App
    // Check attestation, and demo-cli's direct-Firestore session can never target different apps
    ...DEMO_FIREBASE_CLIENT_CONFIG,
    databaseURL: 'https://dereekb-components-default-rtdb.firebaseio.com',
    storageBucket: 'dereekb-components.appspot.com',
    messagingSenderId: '124286307516',
    measurementId: 'G-516GZEXT2Z',
    emulators: {
      ...firebaseInfo.emulators,
      useEmulators: true,
      host: '0.0.0.0'
    },
    appCheck: {
      reCaptchaV3: '6LfojyAgAAAAADvgGBkWUbRJy-4660ZgkLFOtMvS'
    }
  },
  mapbox: {
    token: 'pk.eyJ1IjoiZGVyZWVrYiIsImEiOiJjbDZ0bmxtNWsxcTRrM2RyMzBqM2liNGxzIn0.3uE_-LqdMC0SmZSYSag0Mw',
    defaultCenter: [38.12078919594712, -98.18612358507816],
    defaultZoom: 2
  },
  oidc: {
    // local development is single-origin
    apiOrigin: undefined
  },
  externalConnections: {
    // `ng serve` hosts the app on 9010, but the OAuth controller is behind the Firebase Hosting
    // emulator on 9901, so the connect redirect has to cross to that origin
    authorizeOrigin: 'http://localhost:9901'
  }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
