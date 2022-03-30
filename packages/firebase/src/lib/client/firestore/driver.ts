import { FirestoreDrivers } from './../../common/firestore/firestore';
import { firestoreClientAccessorDriver } from './driver.accessor';
import { firestoreClientQueryDriver } from './driver.query';

export interface FirestoreClientDrivers extends FirestoreDrivers { }

export function firestoreClientDrivers(): FirestoreClientDrivers {
  return {
    firestoreAccessorDriver: firestoreClientAccessorDriver(),
    firestoreQueryDriver: firestoreClientQueryDriver()
  };
}
