import { CollectionReference, doc, getDoc, setDoc } from '@firebase/firestore';
import { MockItemCollectionFixture, testWithMockItemFixture } from '../common/firestore.mock.item.fixture';
import { authorizedFirestoreFactory } from './firestore.authorized';

describe('testWithMockItemFixture', () => {

  const testWrapper = testWithMockItemFixture()(authorizedFirestoreFactory);

  testWrapper((f: MockItemCollectionFixture) => {

    it('should create a document', async () => {
      const documentRef = doc(f.instance.collection as CollectionReference);

      await setDoc(documentRef, {
        test: true
      });

      const snapshot = await getDoc(documentRef);

      expect(snapshot).toBeDefined();
      expect(snapshot.exists()).toBe(true);
    });

  });

});
