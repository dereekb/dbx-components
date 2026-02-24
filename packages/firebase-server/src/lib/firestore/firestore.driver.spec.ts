import { describeFirestoreQueryDriverTests, describeFirestoreAccessorDriverTests } from '@dereekb/firebase/test';
import { dbxComponentsAdminTestWithMockItemCollection } from '@dereekb/firebase-server/test';

describe('firestore server', () => {
  dbxComponentsAdminTestWithMockItemCollection((f) => {
    describeFirestoreAccessorDriverTests(f);
  });

  dbxComponentsAdminTestWithMockItemCollection((f) => {
    describeFirestoreQueryDriverTests(f);
  });
});
