import { InjectionToken } from '@angular/core';
import { FirebaseOptions } from 'firebase/app';
import { DbxFirebaseLoginModuleRootConfig } from '../auth/login/firebase.login.module';
import { DbxFirebaseAppCheckConfig } from './appcheck';
import { DbxFirebaseEmulatorsConfig } from './emulators';

export const DBX_FIREBASE_OPTIONS_TOKEN = new InjectionToken('DbxFirebaseOptions');

export interface DbxFirebaseOptions extends FirebaseOptions, Pick<DbxFirebaseLoginModuleRootConfig, 'enabledLoginMethods'> {
  emulators: DbxFirebaseEmulatorsConfig;
  /**
   * Firebase AppCheck handling
   */
  appCheck?: DbxFirebaseAppCheckConfig;
  /**
   * Passed to the Functions initialization to set the domain to use when sending requests.
   */
  functionsRegionOrCustomDomain?: string | undefined;
}
