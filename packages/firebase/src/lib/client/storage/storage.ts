import { type FirebaseStorageContextFactory, firebaseStorageContextFactory } from '../../common/storage/context';
import { firebaseStorageClientDrivers } from './driver';

/**
 * Pre-configured {@link FirebaseStorageContextFactory} for client-side (browser) Firebase Storage usage.
 *
 * Wires the client Storage drivers (from the `firebase/storage` SDK) into the abstract
 * {@link FirebaseStorageContextFactory} so that file and folder operations use the client-side implementation.
 *
 * @example
 * ```ts
 * const context = clientFirebaseStorageContextFactory(storage);
 * const file = context.file({ bucketId: 'my-bucket', pathString: 'uploads/image.png' });
 * ```
 */
export const clientFirebaseStorageContextFactory: FirebaseStorageContextFactory = firebaseStorageContextFactory(firebaseStorageClientDrivers());
