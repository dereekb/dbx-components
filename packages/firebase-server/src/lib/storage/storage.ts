import { FirebaseStorageContextFactory, firebaseStorageContextFactory } from '@dereekb/firebase';
import { googleCloudFirebaseStorageDrivers } from './driver';
import { Storage as FirebaseAdminStorage } from 'firebase-admin/lib/storage/storage';
import { Storage as GoogleCloudStorage } from '@google-cloud/storage';

/**
 * Creates a FirestoreContextFactory that uses the @google-cloud/storage package.
 */
export const googleCloudFirebaseStorageContextFactory: FirebaseStorageContextFactory = firebaseStorageContextFactory(googleCloudFirebaseStorageDrivers());

interface FirebaseAdminStorageRefLike {
  readonly storageClient: GoogleCloudStorage;
}

/**
 * Retrieves the GoogleCloudStorage object from the input FirebaseAdmin Storage type.
 *
 * @param storage
 * @returns
 */
export function googleCloudStorageFromFirebaseAdminStorage(storage: FirebaseAdminStorage): GoogleCloudStorage {
  return (storage as unknown as FirebaseAdminStorageRefLike).storageClient;
}
