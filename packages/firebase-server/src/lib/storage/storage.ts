import { FirebaseStorageContextFactory, firebaseStorageContextFactory, FirestoreContextFactory, firestoreContextFactory } from '@dereekb/firebase';
import { googleCloudFirebaseStorageDrivers } from './driver';

/**
 * Creates a FirestoreContextFactory that uses the @google-cloud/storage package.
 */
export const googleCloudFirebaseStorageContextFactory: FirebaseStorageContextFactory = firebaseStorageContextFactory(googleCloudFirebaseStorageDrivers());
