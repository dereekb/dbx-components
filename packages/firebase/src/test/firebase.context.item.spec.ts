import { setDoc } from '@firebase/firestore';
import { TestItemCollectionFixture, testWithTestItemFixture } from './firebase.context.item';
import { authorizedFirebase } from './firebase.context';
import { doc, getDoc } from 'firebase/firestore';

describe('testWithTestItemFixture', () => {

  const testWrapper = testWithTestItemFixture()(authorizedFirebase);

  testWrapper((f: TestItemCollectionFixture) => {

    it('should create a document', async () => {

      const documentRef = doc(f.instance.testItemCollection);

      await setDoc(documentRef, {
        test: true
      });

      const snapshot = await getDoc(documentRef);

      expect(snapshot).toBeDefined();
      expect(snapshot.exists()).toBe(true);

    });

  });

});
