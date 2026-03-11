import { testWithMockItemStorageFixture } from '@dereekb/firebase/test';
import { type TestContextFactory } from '@dereekb/util/test';
import { type GoogleCloudTestFirebaseStorageContextFixture, googleCloudTestFirebaseStorageBuilder } from './storage';

/**
 * A {@link TestContextFactory} that produces {@link GoogleCloudTestFirebaseStorageContextFixture} instances.
 *
 * Use this type when declaring or accepting pre-configured storage test factories
 * (e.g., {@link adminFirebaseStorageFactory}) that manage fixture lifecycle automatically.
 */
export type GoogleFirebaseStorageTestContextFactory = TestContextFactory<GoogleCloudTestFirebaseStorageContextFixture>;

/**
 * Default Firebase Storage admin factory.
 *
 * Host of 0.0.0.0, port 9906
 */
export const adminFirebaseStorageFactory: GoogleFirebaseStorageTestContextFactory = googleCloudTestFirebaseStorageBuilder({
  host: '0.0.0.0',
  port: 9906
});

/**
 * Convenience mock instance for tests within an authorized context.
 *
 * Uses @google-cloud/storage
 */
export const dbxComponentsAdminTestWithMockItemStorage = testWithMockItemStorageFixture()(adminFirebaseStorageFactory);
