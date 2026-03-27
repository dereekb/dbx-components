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
 * Permissive Firestore security rules that allow all reads and writes.
 */
export const AUTHORIZED_FIRESTORE_RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
`;

/**
 * Permissive Firebase Storage security rules that allow all reads and writes.
 */
export const AUTHORIZED_STORAGE_RULES = `
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
`;

/**
 * Pre-configured {@link FirebaseTestContextFactory} that provides a fully authorized (all reads/writes allowed)
 * Firebase emulator context for both Firestore and Storage.
 *
 * Uses permissive security rules and authenticates as {@link TESTING_AUTHORIZED_FIREBASE_USER_ID}.
 *
 * **Important:** Only use this factory for tests that actually need Firebase Storage access.
 * Firestore-only tests should use {@link authorizedFirestoreOnlyFactory} instead to avoid
 * interfering with the storage emulator's global rules endpoint during parallel test execution.
 *
 * @example
 * ```ts
 * const f = testWithMockItemStorageFixture()(authorizedFirebaseFactory);
 * ```
 */
export const authorizedFirebaseFactory: FirebaseTestContextFactory = firebaseRulesUnitTestBuilder({
  testEnvironment: {
    firestore: { rules: AUTHORIZED_FIRESTORE_RULES },
    storage: { rules: AUTHORIZED_STORAGE_RULES }
  },
  rulesContext: { userId: TESTING_AUTHORIZED_FIREBASE_USER_ID }
});

/**
 * Pre-configured {@link FirebaseTestContextFactory} that provides a fully authorized Firestore-only
 * emulator context without configuring Storage rules.
 *
 * Use this for Firestore-only tests when running with parallel workers. The Firebase Storage
 * emulator maintains rules globally (not per-project like Firestore), so `initializeTestEnvironment`
 * calls that include storage rules from non-storage workers will hit `PUT /internal/setRules`
 * concurrently, which can cause transient `storage/unauthorized` errors in the storage test worker.
 *
 * @example
 * ```ts
 * const f = testWithMockItemCollectionFixture()(authorizedFirestoreOnlyFactory);
 * ```
 */
export const authorizedFirestoreOnlyFactory: FirebaseTestContextFactory = firebaseRulesUnitTestBuilder({
  testEnvironment: {
    firestore: { rules: AUTHORIZED_FIRESTORE_RULES }
  },
  rulesContext: { userId: TESTING_AUTHORIZED_FIREBASE_USER_ID }
});
