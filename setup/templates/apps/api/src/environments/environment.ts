import { type FirebaseServerEnvironmentConfig } from '@dereekb/firebase-server';

export const environment: FirebaseServerEnvironmentConfig = {
  production: false,
  developerToolsEnabled: true,
  appUrl: 'http://localhost:FIREBASE_EMULATOR_HOSTING_PORT'
};
