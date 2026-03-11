import { type FirebaseStorageContextFactory, firebaseStorageContextFactory } from '@dereekb/firebase';
import { googleCloudFirebaseStorageDrivers } from './driver';
import { type Storage as FirebaseAdminStorage } from 'firebase-admin/storage';
import { type Storage as GoogleCloudStorage } from '@google-cloud/storage';

/**
 * Pre-configured {@link FirebaseStorageContextFactory} using the Google Cloud Storage (Admin SDK) drivers.
 */
export const googleCloudFirebaseStorageContextFactory: FirebaseStorageContextFactory = firebaseStorageContextFactory(googleCloudFirebaseStorageDrivers());

interface FirebaseAdminStorageRefLike {
  readonly storageClient: GoogleCloudStorage;
}

/**
 * Extracts the underlying {@link GoogleCloudStorage} client from a Firebase Admin {@link FirebaseAdminStorage} instance.
 *
 * This accesses an internal property (`storageClient`) to bridge between the Firebase Admin
 * Storage wrapper and the raw Google Cloud Storage SDK.
 *
 * @param storage - The Firebase Admin Storage instance.
 *
 * @example
 * ```typescript
 * const gcs = googleCloudStorageFromFirebaseAdminStorage(admin.storage());
 * ```
 */
export function googleCloudStorageFromFirebaseAdminStorage(storage: FirebaseAdminStorage): GoogleCloudStorage {
  return (storage as unknown as FirebaseAdminStorageRefLike).storageClient;
}
