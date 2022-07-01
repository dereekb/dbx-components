import { FirestoreDrivers } from '@dereekb/firebase';
import { googleCloudFirestoreAccessorDriver } from './driver.accessor';
import { googleCloudFirestoreQueryDriver } from './driver.query';

export type GoogleCloudFirestoreDrivers = FirestoreDrivers;

export function googleCloudFirestoreDrivers(): GoogleCloudFirestoreDrivers {
  return {
    driverIdentifier: '@google-cloud/firestore',
    driverType: 'production',
    firestoreAccessorDriver: googleCloudFirestoreAccessorDriver(),
    firestoreQueryDriver: googleCloudFirestoreQueryDriver()
  };
}
