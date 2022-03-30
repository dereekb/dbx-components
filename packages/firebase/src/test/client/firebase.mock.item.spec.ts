import { doc, getDoc, setDoc } from 'firebase/firestore';
import { MockItemCollectionFixture, testWithMockItemFixture } from '../common/firebase.mock.item.fixture';
import { authorizedFirebaseFactory } from './firebase.authorized';

describe('testWithMockItemFixture', () => {

  const testWrapper = testWithMockItemFixture()(authorizedFirebaseFactory);

  testWrapper((f: MockItemCollectionFixture) => {

    it('should create a document', async () => {
      const documentRef = doc(f.instance.collection);

      await setDoc(documentRef, {
        test: true
      });

      const snapshot = await getDoc(documentRef);

      expect(snapshot).toBeDefined();
      expect(snapshot.exists()).toBe(true);
    });

  });

});
