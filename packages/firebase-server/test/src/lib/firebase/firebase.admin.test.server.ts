import { type MockItemFirestoreCollection, mockItemFirestoreCollection, type TestFirestoreContextFixture, type TestFirestoreInstance } from '@dereekb/firebase/test';
import { initFirebaseAdminTestEnvironment } from './firebase';

export function initFirebaseServerAdminTestEnvironment() {
  initFirebaseAdminTestEnvironment({
    emulators: {
      auth: '0.0.0.0:9903',
      firestore: '0.0.0.0:9904',
      storage: '0.0.0.0:9906'
    }
  });
}

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
