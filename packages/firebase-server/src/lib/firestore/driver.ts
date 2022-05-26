import { FirestoreDrivers } from '@dereekb/firebase';
import { firestoreClientAccessorDriver } from './driver.accessor';
import { firestoreClientQueryDriver } from './driver.query';

export type GoogleCloudFirestoreDrivers = FirestoreDrivers;

export function googleCloudFirestoreDrivers(): GoogleCloudFirestoreDrivers {
  return {
    driverIdentifier: '@google-cloud/firestore',
    driverType: 'production',
    firestoreAccessorDriver: firestoreClientAccessorDriver(),
    firestoreQueryDriver: firestoreClientQueryDriver()
  };
}
