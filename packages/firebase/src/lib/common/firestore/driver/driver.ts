import { FirestoreAccessorDriverRef } from "./accessor";
import { FirestoreQueryDriverRef } from "./query";

export type FirestoreDriverIdentifier = string;
export type FirestoreDriverType = 'production' | 'testing';

/**
 * Implements all Firestore related driver reference interfaces.
 */
export interface FirestoreDrivers extends FirestoreQueryDriverRef, FirestoreAccessorDriverRef {
  driverIdentifier?: FirestoreDriverIdentifier;
  driverType: FirestoreDriverType;
}
