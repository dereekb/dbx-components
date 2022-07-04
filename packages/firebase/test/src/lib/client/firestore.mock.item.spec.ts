import { CollectionReference, doc, getDoc, setDoc } from '@firebase/firestore';
import { MockItemCollectionFixture, testWithMockItemCollectionFixture } from '../common/mock/mock.item.collection.fixture';
import { authorizedFirebaseFactory } from './firebase.authorized';

describe('testWithMockItemFixture', () => {
  const testWrapper = testWithMockItemCollectionFixture()(authorizedFirebaseFactory);

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
