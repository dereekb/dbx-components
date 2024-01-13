import { type FirestoreContextFactory, firestoreContextFactory } from '@dereekb/firebase';
import { googleCloudFirestoreDrivers } from './driver';

/**
 * Creates a FirestoreContextFactory that uses the @'@google-cloud/firestore package.
 */
export const googleCloudFirestoreContextFactory: FirestoreContextFactory = firestoreContextFactory(googleCloudFirestoreDrivers());
