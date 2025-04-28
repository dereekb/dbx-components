// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import { DbxFirebaseOptions } from "@dereekb/dbx-firebase";
import { DbxMapboxOptions } from '@dereekb/dbx-web/mapbox';
import firebaseInfo from '../../../../firebase.json';

export interface APP_CODE_PREFIXEnvironment {
  /**
   * True if this environment should be treated as production.
   * 
   * This should be true for both the staging system and production one, and false for a localhost environment.
   */
  production: boolean;
  /**
   * True if this is a staging app/environment.
   */
  staging: boolean;
  /**
   * True if this is a testing environment (localhost).
   */
  testing: boolean;
  /**
   * Analytics configurations.
   */
  analytics: {
    segment: string;
    hotjar?: string;
    hotjarVersion?: number;
  },
  /**
   * Firebase configurations.
   */
  firebase: DbxFirebaseOptions;
  /**
   * Mapbox configurations.
   */
  mapbox: DbxMapboxOptions;
}

export const base: APP_CODE_PREFIXEnvironment = {
  production: false,
  staging: false,
  testing: false,
  analytics: {
    segment: '0GAAlnvz7dqWk5N6t3Cw89Ep6N1G1MQM'
  },
  firebase: {
    enabledLoginMethods: ['email', 'google', 'github'],
    // You can find this info at: https://console.firebase.google.com/u/0/project/FIREBASE_STAGING_PROJECT_ID/settings/general/
    // Copy paste to override the below
    // ==
    apiKey: "", // TODO: Put your firebase API key here
    authDomain: '', // TODO: Put your firebase Auth domain here
    projectId: 'FIREBASE_STAGING_PROJECT_ID', // TODO: Put your firebase project id here
    storageBucket: '', // TODO: Put your firebase storage bucket here
    messagingSenderId: '', // TODO: Put your firebase messaging sender id here
    appId: '',  // TODO: Put your firebase app id here
    // ==
    // The measurement id is only available if you're using google analytics
    measurementId: '', // TODO: Put your firebase staging measurement id here,
    emulators: {
      ...firebaseInfo.emulators,
      useEmulators: true,
      host: '0.0.0.0'
    }
  },
  mapbox: {
    token: '', // TODO: put your testing mapbox token here that should be configured for localhost
    defaultCenter: [38.12078919594712, -98.18612358507816],
    defaultZoom: 4,
    defaultStyle: 'mapbox://styles/mapbox/streets-v12'
  }
};
