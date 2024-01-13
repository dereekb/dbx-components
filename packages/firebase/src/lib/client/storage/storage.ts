import { type FirebaseStorageContextFactory, firebaseStorageContextFactory } from '../../common/storage/context';
import { firebaseStorageClientDrivers } from './driver';

/**
 * Creates a FirebaseStorageContextFactory that uses the client @firebase/storage package.
 */
export const clientFirebaseStorageContextFactory: FirebaseStorageContextFactory = firebaseStorageContextFactory(firebaseStorageClientDrivers());
