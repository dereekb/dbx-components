import { FirebaseStorageDrivers, FirestoreDrivers } from '@dereekb/firebase';
import { googleCloudStorageFirebaseStorageAccessorDriver } from './driver.accessor';

export type GoogleCloudFirebaseStorageDrivers = FirebaseStorageDrivers;

export function googleCloudFirebaseStorageDrivers(): GoogleCloudFirebaseStorageDrivers {
  return {
    driverIdentifier: '@google-cloud/storage',
    driverType: 'production',
    storageAccessorDriver: googleCloudStorageFirebaseStorageAccessorDriver()
  };
}
