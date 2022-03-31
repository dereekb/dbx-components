import { JestTestContextFactory } from '@dereekb/util';
import { GoogleFirestoreFirebaseTestingContextFixture, googleFirestoreTestBuilder } from './firestore';

export type FirebaseTestContextFactory = JestTestContextFactory<GoogleFirestoreFirebaseTestingContextFixture>;

/**
 * Default firestore admin factory. 
 * 
 * Host of localhost, port 9904
 */
export const adminFirestoreFactory: FirebaseTestContextFactory = googleFirestoreTestBuilder({
  host: 'localhost',
  port: 9904
});
