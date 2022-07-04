import { FirestoreDrivers } from '@dereekb/firebase';
import { googleCloudFirestoreAccessorDriver } from './driver.accessor';
import { googleCloudFirestoreQueryDriver } from './driver.query';

export type GoogleCloudFirestoreDrivers = FirestoreDrivers;

export function googleCloudFirestoreDrivers(): GoogleCloudFirestoreDrivers {
  return {
    firestoreDriverIdentifier: '@google-cloud/firestore',
    firestoreDriverType: 'production',
    firestoreAccessorDriver: googleCloudFirestoreAccessorDriver(),
    firestoreQueryDriver: googleCloudFirestoreQueryDriver()
  };
}
