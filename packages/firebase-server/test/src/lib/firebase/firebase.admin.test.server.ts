import { type MockItemFirestoreCollection, mockItemFirestoreCollection, type TestFirestoreContextFixture, type TestFirestoreInstance } from '@dereekb/firebase/test';
import { initFirebaseAdminTestEnvironment } from './firebase';

/**
 * Initializes the Firebase Admin test environment with the default emulator ports
 * used by the `@dereekb/firebase-server` test suite.
 *
 * This is a convenience wrapper around {@link initFirebaseAdminTestEnvironment} that
 * pre-configures auth (9903), firestore (9904), and storage (9906) on `0.0.0.0`.
 * Call this once at the top of each test file (or in a global setup) before any
 * Firebase Admin SDK calls are made.
 *
 * @example
 * ```ts
 * beforeAll(() => {
 *   initFirebaseServerAdminTestEnvironment();
 * });
 * ```
 */
export function initFirebaseServerAdminTestEnvironment() {
  initFirebaseAdminTestEnvironment({
    emulators: {
      auth: '0.0.0.0:9903',
      firestore: '0.0.0.0:9904',
      storage: '0.0.0.0:9906'
    }
  });
}

/**
 * Registers a smoke-test `describe` block that verifies basic Firestore connectivity
 * against the emulator.
 *
 * Creates a {@link MockItemFirestoreCollection}, writes a document, and asserts it exists.
 * Useful as a sanity check inside larger test suites to confirm the emulator is reachable
 * and the fixture is wired up correctly.
 *
 * @param s - The firestore context fixture providing the active {@link TestFirestoreContext}.
 */
export function describeFirestoreTest(s: TestFirestoreContextFixture<TestFirestoreInstance>) {
  let collection: MockItemFirestoreCollection;

  beforeEach(() => {
    collection = mockItemFirestoreCollection(s.firestoreContext);
  });

  describe('firestore', () => {
    it('should interact with the firestore.', async () => {
      const document = collection.documentAccessor().newDocument();

      const setData = {
        value: 'a',
        test: true
      };

      await document.accessor.set(setData);

      const exists = await document.accessor.exists();
      expect(exists).toBe(true);

      const snapshot = await document.accessor.get();
      const data = snapshot.data();

      expect(data).toBeDefined();
    });
  });
}
