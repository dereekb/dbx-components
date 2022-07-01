import { FirebaseStorageDrivers } from '../../common/storage/driver/driver';
import { firebaseStorageClientAccessorDriver } from './driver.accessor';

export type FirebaseStorageClientDrivers = FirebaseStorageDrivers;

export function firebaseStorageClientDrivers(): FirebaseStorageClientDrivers {
  return {
    driverIdentifier: '@firebase/storage',
    driverType: 'production',
    storageAccessorDriver: firebaseStorageClientAccessorDriver()
  };
}
