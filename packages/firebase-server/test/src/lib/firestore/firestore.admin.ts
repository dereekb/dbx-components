import { type JestTestContextFactory } from '@dereekb/util/test';
import { type GoogleCloudTestFirestoreContextFixture, googleCloudTestFirestoreBuilder } from './firestore';
import { testWithMockItemCollectionFixture } from '@dereekb/firebase/test';

export type GoogleFirebaseFirestoreTestContextFactory = JestTestContextFactory<GoogleCloudTestFirestoreContextFixture>;

/**
 * Default firestore admin factory.
 *
 * Host of localhost, port 9904
 */
export const adminFirestoreFactory: GoogleFirebaseFirestoreTestContextFactory = googleCloudTestFirestoreBuilder({
  host: 'localhost',
  port: 9904
});

/**
 * Convenience mock instance for tests within an authorized context.
 *
 * Uses @google-cloud/firestore
 */
export const dbxComponentsAdminTestWithMockItemCollection = testWithMockItemCollectionFixture()(adminFirestoreFactory);
