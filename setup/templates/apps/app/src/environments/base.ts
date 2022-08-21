// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import { DbxFirebaseOptions } from "@dereekb/dbx-firebase";
import { DbxMapboxOptions } from '@dereekb/dbx-web/mapbox';
import firebaseInfo from '../../../../firebase.json';

export interface APP_CODE_PREFIXEnvironment {
  production: boolean;
  testing: boolean;
  analytics: {
    segment: string;
  },
  firebase: DbxFirebaseOptions;
  mapbox: DbxMapboxOptions;
}

export const base: APP_CODE_PREFIXEnvironment = {
  production: false,
  testing: false,
  analytics: {
    segment: '0GAAlnvz7dqWk5N6t3Cw89Ep6N1G1MQM'
  },
  firebase: {
    enabledLoginMethods: ['email', 'google', 'github'],
    apiKey: "", // TODO: Put your firebase API key here
    authDomain: '', // TODO: Put your firebase Auth domain here
    databaseURL: '',  // TODO: Put your firebase database url here
    projectId: '', // TODO: Put your firebase project id here
    storageBucket: '', // TODO: Put your firebase storage bucket here
    messagingSenderId: '', // TODO: Put your firebase messaging sender id here
    appId: '',  // TODO: Put your firebase app id here
    measurementId: '', // TODO: Put your firebase measurement id here,
    emulators: {
      ...firebaseInfo.emulators,
      useEmulators: true,
      host: '0.0.0.0'
    }
  },
  mapbox: {
    token: '' // TODO: put your mapbox token here, or delete it
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
