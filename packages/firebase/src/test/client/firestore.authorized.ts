import { JestTestContextFactory } from '@dereekb/util';
import { firestoreTestBuilder, RulesUnitTestFirebaseTestingContextFixture } from './firestore';

export const TESTING_AUTHORIZED_FIREBASE_USER_ID = '0';

export type FirebaseTestContextFactory = JestTestContextFactory<RulesUnitTestFirebaseTestingContextFixture>;

export const authorizedFirestoreFactory: FirebaseTestContextFactory = firestoreTestBuilder({
  testEnvironment: {
    firestore: {
      rules: `
      rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /{document=**} {
            allow read, write: if true;
          }
        }
      }
      `
    }
  },
  rulesContext: { userId: TESTING_AUTHORIZED_FIREBASE_USER_ID }
});
