import { FirestoreDrivers } from './../../common/firestore/firestore';

export interface FirestoreClientDrivers extends FirestoreDrivers { }

export function firestoreClientDrivers(): FirestoreClientDrivers {
  return {
    firestoreAccessorDriver: undefined,
    firestoreQueryDriver: undefined
  };
}
