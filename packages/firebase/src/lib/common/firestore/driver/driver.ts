import { type FirestoreAccessorDriverRef } from './accessor';
import { type FirestoreQueryDriverRef } from './query';

export type FirestoreDriverIdentifier = string;
export type FirestoreDriverType = 'production' | 'testing';

/**
 * Implements all Firestore related driver reference interfaces.
 */
export interface FirestoreDrivers extends FirestoreQueryDriverRef, FirestoreAccessorDriverRef {
  firestoreDriverIdentifier?: FirestoreDriverIdentifier;
  firestoreDriverType: FirestoreDriverType;
}
