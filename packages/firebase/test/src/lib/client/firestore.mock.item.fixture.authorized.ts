import { testWithMockItemCollectionFixture } from '../common/mock/mock.item.collection.fixture';
import { testWithMockItemStorageFixture } from '../common/mock/mock.item.storage.fixture';
import { authorizedFirebaseFactory, authorizedFirestoreOnlyFactory } from './firebase.authorized';

/**
 * Convenience mock instance for collection tests within an authorized firebase context.
 *
 * Uses {@link authorizedFirestoreOnlyFactory} to avoid touching the Storage emulator's
 * global rules endpoint, preventing interference with parallel storage test workers.
 *
 * Uses @firebase/firestore. This is ONLY for the client.
 */
export const authorizedTestWithMockItemCollection = testWithMockItemCollectionFixture()(authorizedFirestoreOnlyFactory);

/**
 * Convenience mock instance for storage tests within an authorized firebase context.
 *
 * Uses @firebase/storage. This is ONLY for the client.
 */
export const authorizedTestWithMockItemStorage = testWithMockItemStorageFixture()(authorizedFirebaseFactory);
