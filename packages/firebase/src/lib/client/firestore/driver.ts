import { FirestoreDrivers } from '../../common/firestore/driver/driver';
import { firestoreClientAccessorDriver } from './driver.accessor';
import { firebaseFirestoreQueryDriver } from './driver.query';

export type FirebaseFirestoreClientDrivers = FirestoreDrivers;

export function firebaseFirestoreClientDrivers(): FirebaseFirestoreClientDrivers {
  return {
    firestoreDriverIdentifier: '@firebase/firestore',
    firestoreDriverType: 'production',
    firestoreAccessorDriver: firestoreClientAccessorDriver(),
    firestoreQueryDriver: firebaseFirestoreQueryDriver()
  };
}
