import { FirestoreDrivers } from '../../common/firestore/driver/driver';
import { firestoreClientAccessorDriver } from './driver.accessor';
import { firebaseFirestoreQueryDriver } from './driver.query';

export interface FirebaseFirestoreClientDrivers extends FirestoreDrivers { }

export function firebaseFirestoreClientDrivers(): FirebaseFirestoreClientDrivers {
  return {
    driverIdentifier: '@firebase/firestore',
    driverType: 'production',
    firestoreAccessorDriver: firestoreClientAccessorDriver(),
    firestoreQueryDriver: firebaseFirestoreQueryDriver()
  };
}
