import { MockItemFirestoreCollection, mockItemFirestoreCollection, TestFirestoreContextFixture, TestFirestoreInstance } from "@dereekb/firebase";
import { initFirebaseAdminTestEnvironment } from "./firebase.admin";

export function initFirebaseServerAdminTestEnvironment() {
  initFirebaseAdminTestEnvironment({
    emulators: {
      auth: '0.0.0.0:9903',
      firestore: '0.0.0.0:9904',
      storage: '0.0.0.0:9906'
    }
  })
}


export function describeFirestoreTest(s: TestFirestoreContextFixture<TestFirestoreInstance>) {

  let collection: MockItemFirestoreCollection;

  beforeEach(() => {
    collection = mockItemFirestoreCollection(s.context);
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
