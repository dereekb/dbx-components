import { InjectionToken } from '@angular/core';
import { FirebaseOptions } from 'firebase/app';
import { DbxFirebaseLoginModuleRootConfig } from '../auth/login/firebase.login.module';
import { DbxFirebaseAppCheckConfig } from './appcheck';
import { DbxFirebaseEmulatorsConfig } from './emulators';
import { PersistentCacheSettings } from 'firebase/firestore';

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
  /**
   * Whether or not to call enableMultiTabIndexedDbPersistence() for firestore at setup time.
   *
   * True by default.
   */
  enableMultiTabIndexedDbPersistence?: boolean;
  /**
   * Whether or not to call enableIndexedDbPersistence() for firestore at setup time.
   *
   * True by default if enableMultiTabIndexedDbPersistence is false.
   */
  enableIndexedDbPersistence?: boolean;
  /**
   * Optional persistent cache setting to pass to the Firestore cache.
   */
  persistentCacheSettings?: Omit<PersistentCacheSettings, 'tabManager'>;
}
