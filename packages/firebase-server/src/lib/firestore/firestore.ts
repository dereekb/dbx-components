import { FirestoreContextFactory, firestoreContextFactory } from '@dereekb/firebase';
import { googleCloudFirestoreDrivers } from "./driver";

/**
 * Creates a FirestoreContextFactory that uses the @firebase/firebase package.
 */
export const makeFirestoreContext: FirestoreContextFactory = firestoreContextFactory(googleCloudFirestoreDrivers());
