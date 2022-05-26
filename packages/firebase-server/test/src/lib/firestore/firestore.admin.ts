import { JestTestContextFactory } from '@dereekb/util/test';
import { GoogleCloudTestFirestoreContextFixture, googleCloudTestFirestoreBuilder } from './firestore';

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
