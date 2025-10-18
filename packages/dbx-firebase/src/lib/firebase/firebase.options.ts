import { InjectionToken } from '@angular/core';
import { type PersistentCacheSettings } from 'firebase/firestore';
import { type FirebaseOptions } from 'firebase/app';
import { type DbxFirebaseAppCheckConfig } from './appcheck';
import { type DbxFirebaseEmulatorsConfig } from './emulators';

export const DBX_FIREBASE_APP_OPTIONS_TOKEN = new InjectionToken<DbxFirebaseAppOptions>('DbxFirebaseOptions');

/**
 * Extends FirebaseOptions with additional properties for configuring the underlying client-side Firebase services.
 */
export interface DbxFirebaseAppOptions extends FirebaseOptions {
  readonly emulators: DbxFirebaseEmulatorsConfig;
  /**
   * Firebase AppCheck handling
   */
  readonly appCheck?: DbxFirebaseAppCheckConfig;
  /**
   * Passed to the Functions initialization to set the domain to use when sending requests.
   */
  readonly functionsRegionOrCustomDomain?: string | undefined;
  /**
   * Whether or not to call enableMultiTabIndexedDbPersistence() for firestore at setup time.
   *
   * True by default.
   */
  readonly enableMultiTabIndexedDbPersistence?: boolean;
  /**
   * Whether or not to call enableIndexedDbPersistence() for firestore at setup time.
   *
   * True by default if enableMultiTabIndexedDbPersistence is false.
   */
  readonly enableIndexedDbPersistence?: boolean;
  /**
   * Optional persistent cache setting to pass to the Firestore cache.
   */
  readonly persistentCacheSettings?: Omit<PersistentCacheSettings, 'tabManager'>;
}
