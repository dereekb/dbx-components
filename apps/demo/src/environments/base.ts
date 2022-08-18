// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import { DbxFirebaseOptions } from '@dereekb/dbx-firebase';
import firebaseInfo from '../../../../firebase.json';

export interface DemoEnvironment {
  production: boolean;
  testing: boolean;
  analytics: {
    segment: string;
  };
  firebase: DbxFirebaseOptions;
  mapbox: {
    token: string;
  };
}

export const base: DemoEnvironment = {
  production: false,
  testing: false,
  analytics: {
    segment: '0GAAlnvz7dqWk5N6t3Cw89Ep6N1G1MQM'
  },
  firebase: {
    enabledLoginMethods: ['email', 'google', 'github'],
    apiKey: 'AIzaSyBl5QlQNS-AGrGIuZRI4CDHHBzUovUDABM',
    authDomain: 'dereekb-components.firebaseapp.com',
    databaseURL: 'https://dereekb-components-default-rtdb.firebaseio.com',
    projectId: 'dereekb-components',
    storageBucket: 'dereekb-components.appspot.com',
    messagingSenderId: '124286307516',
    appId: '1:124286307516:web:eb5a7cf891a6fd1b1ed4b9',
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
    token: 'pk.eyJ1IjoiZGVyZWVrYiIsImEiOiJjbDZ0bmxtNWsxcTRrM2RyMzBqM2liNGxzIn0.3uE_-LqdMC0SmZSYSag0Mw'
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
