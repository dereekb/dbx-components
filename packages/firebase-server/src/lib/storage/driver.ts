import { FirebaseStorageDrivers } from '@dereekb/firebase';
import { googleCloudStorageFirebaseStorageAccessorDriver } from './driver.accessor';

export type GoogleCloudFirebaseStorageDrivers = FirebaseStorageDrivers;

export function googleCloudFirebaseStorageDrivers(): GoogleCloudFirebaseStorageDrivers {
  return {
    storageDriverIdentifier: '@google-cloud/storage',
    storageDriverType: 'production',
    storageAccessorDriver: googleCloudStorageFirebaseStorageAccessorDriver()
  };
}
