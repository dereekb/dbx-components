import { type TestContextFactory } from '@dereekb/util/test';
import { firebaseRulesUnitTestBuilder, type RulesUnitTestFirebaseTestingContextFixture } from './firebase';

/**
 * Default user ID used for the authenticated context in client-side Firebase tests.
 */
export const TESTING_AUTHORIZED_FIREBASE_USER_ID = '0';

/**
 * Convenience type alias for a test context factory that produces {@link RulesUnitTestFirebaseTestingContextFixture} instances.
 */
export type FirebaseTestContextFactory = TestContextFactory<RulesUnitTestFirebaseTestingContextFixture>;

/**
 * Pre-configured {@link FirebaseTestContextFactory} that provides a fully authorized (all reads/writes allowed)
 * Firebase emulator context for both Firestore and Storage.
 *
 * Uses permissive security rules and authenticates as {@link TESTING_AUTHORIZED_FIREBASE_USER_ID}.
 * This is the most common base factory for client-side mock item tests.
 *
 * @example
 * ```ts
 * const f = testWithMockItemCollectionFixture()(authorizedFirebaseFactory);
 * ```
 */
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
