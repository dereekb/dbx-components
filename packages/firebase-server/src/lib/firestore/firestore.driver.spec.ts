import { describeFirestoreQueryDriverTests, describeFirestoreAccessorDriverTests } from '@dereekb/firebase/test';
import { dbxComponentsAdminTestWithMockItemCollection } from '@dereekb/firebase-server/test';

jest.setTimeout(9000);

describe('firestore server', () => {
  dbxComponentsAdminTestWithMockItemCollection((f) => {
    describeFirestoreAccessorDriverTests(f);
  });

  dbxComponentsAdminTestWithMockItemCollection((f) => {
    describeFirestoreQueryDriverTests(f);
  });
});
