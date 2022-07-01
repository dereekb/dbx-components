import { FirebaseStorageDrivers } from './driver/driver';
import { FirebaseStorage } from './types';

/**
 * A @dereekb/firebase FirebaseStorageContext. Wraps the main FirebaseStorage context and the drivers, as well as utility/convenience functions.
 */
export interface FirebaseStorageContext<F extends FirebaseStorage = FirebaseStorage> {
  readonly storage: F;
  readonly drivers: FirebaseStorageDrivers;
}

/**
 * Factory function for generating a FirebaseStorageContext given the input FirebaseStorage.
 */
export type FirebaseStorageContextFactory<F extends FirebaseStorage = FirebaseStorage> = (firebaseStorage: F) => FirebaseStorageContext;

/**
 * Creates a new FirebaseStorageContextFactory given the input FirebaseStorageDrivers.
 *
 * @param drivers
 * @returns
 */
export function firebaseStorageContextFactory<F extends FirebaseStorage = FirebaseStorage>(drivers: FirebaseStorageDrivers): FirebaseStorageContextFactory<F> {
  return (firebaseStorage: F) => {
    const context: FirebaseStorageContext<F> = {
      storage: firebaseStorage,
      drivers
    };

    return context;
  };
}
