import { FirestoreDrivers } from './../../common/firestore/firestore';
import { firestoreClientAccessorDriver } from './driver.accessor';
import { firebaseFirestoreQueryDriver } from './driver.query';

export interface FirestoreClientDrivers extends FirestoreDrivers { }

export function firestoreClientDrivers(): FirestoreClientDrivers {
  return {
    firestoreAccessorDriver: firestoreClientAccessorDriver(),
    firestoreQueryDriver: firebaseFirestoreQueryDriver()
  };
}
