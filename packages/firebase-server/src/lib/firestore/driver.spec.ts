import { describeFirestoreQueryDriverTests, describeFirestoreAccessorDriverTests } from '@dereekb/firebase/test';
import { adminTestWithMockItemCollection } from '@dereekb/firebase-server/test';

jest.setTimeout(9000);

describe('firestore server', () => {
  adminTestWithMockItemCollection((f) => {
    describeFirestoreAccessorDriverTests(f);
  });

  adminTestWithMockItemCollection((f) => {
    describeFirestoreQueryDriverTests(f);
  });
});
