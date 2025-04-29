import { base, APP_CODE_PREFIXEnvironment } from './base';

export const environment: APP_CODE_PREFIXEnvironment = {
  ...base,
  production: true,
  firebase: {
    enableIndexedDbPersistence: false,
    enableMultiTabIndexedDbPersistence: true,
    enabledLoginMethods: ['email', 'google', 'github'],
    // You can find this info at: https://console.firebase.google.com/u/0/project/FIREBASE_PROJECT_ID/settings/general/
    // Copy paste to override the below
    // ==
    apiKey: "", // TODO: Put your firebase API key here
    authDomain: '', // TODO: Put your firebase Auth domain here
    projectId: 'FIREBASE_PROJECT_ID', // TODO: Put your firebase project id here
    storageBucket: '', // TODO: Put your firebase storage bucket here
    messagingSenderId: '', // TODO: Put your firebase messaging sender id here
    appId: '',  // TODO: Put your firebase app id here
    // ==
    // The measurement id is only available if you're using google analytics
    measurementId: '', // TODO: Put your firebase measurement id here,
    emulators: {
      useEmulators: false
    },
    appCheck: {
      reCaptchaV3: '' // TODO: Configure App Check for production!
    }
  },
  analytics: {
    segment: '', // TODO: Configure Segment for production!
  },
  mapbox: {
    ...base.mapbox,
    token: '' // TODO: put your production mapbox token here that should be configured for your domain url
  }
};
