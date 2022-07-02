import { JestTestContextFactory } from '@dereekb/util/test';
import { firebaseRulesUnitTestBuilder, RulesUnitTestFirebaseTestingContextFixture } from './firebase';

export const TESTING_AUTHORIZED_FIREBASE_USER_ID = '0';

export type FirebaseTestContextFactory = JestTestContextFactory<RulesUnitTestFirebaseTestingContextFixture>;

export const authorizedFirebaseFactory: FirebaseTestContextFactory = firebaseRulesUnitTestBuilder({
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
    },
    storage: {
      rules: `
      rules_version = '2';
      service firebase.storage {
        match /b/{bucket}/o {
          match /{allPaths=**} {
            allow read, write: if true;
          }
        }
      }
      `
    }
  },
  rulesContext: { userId: TESTING_AUTHORIZED_FIREBASE_USER_ID }
});
