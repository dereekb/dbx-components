import { FirestoreContextFactory, firestoreContextFactory } from '../../common/firestore/context';
import { firebaseFirestoreClientDrivers } from './driver';

/**
 * Creates a FirestoreContextFactory that uses the @firebase/firebase package.
 */
export const firebaseFirestoreContextFactory: FirestoreContextFactory = firestoreContextFactory(firebaseFirestoreClientDrivers());
