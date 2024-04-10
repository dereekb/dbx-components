import { testWithMockItemStorageFixture } from '@dereekb/firebase/test';
import { JestTestContextFactory } from '@dereekb/util/test';
import { GoogleCloudTestFirebaseStorageContextFixture, googleCloudTestFirebaseStorageBuilder } from './storage';

export type GoogleFirebaseStorageTestContextFactory = JestTestContextFactory<GoogleCloudTestFirebaseStorageContextFixture>;

/**
 * Default firestore admin factory.
 *
 * Host of localhost, port 9906
 */
export const adminFirebaseStorageFactory: GoogleFirebaseStorageTestContextFactory = googleCloudTestFirebaseStorageBuilder({
  host: '0.0.0.0',
  port: 9906
});

/**
 * Convenience mock instance for tests within an authorized context.
 *
 * Uses @google-cloud/firestore
 */
export const dbxComponentsAdminTestWithMockItemStorage = testWithMockItemStorageFixture()(adminFirebaseStorageFactory);
