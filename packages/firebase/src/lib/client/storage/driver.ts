import { type FirebaseStorageDrivers } from '../../common/storage/driver/driver';
import { firebaseStorageClientAccessorDriver } from './driver.accessor';

export type FirebaseStorageClientDrivers = FirebaseStorageDrivers;

export function firebaseStorageClientDrivers(): FirebaseStorageClientDrivers {
  return {
    storageDriverIdentifier: '@firebase/storage',
    storageDriverType: 'production',
    storageAccessorDriver: firebaseStorageClientAccessorDriver()
  };
}
