import { type FirebaseStorageAccessorDriverRef } from './accessor';

export type FirebaseStorageDriverIdentifier = string;
export type FirebaseStorageDriverType = 'production' | 'testing';

/**
 * Implements all FirebaseStorage related driver reference interfaces.
 */
export interface FirebaseStorageDrivers extends FirebaseStorageAccessorDriverRef {
  storageDriverIdentifier?: FirebaseStorageDriverIdentifier;
  storageDriverType: FirebaseStorageDriverType;
}
