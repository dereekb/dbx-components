import { authorizedTestWithMockItemCollection, changeFirestoreLogLevelBeforeAndAfterTests, describeFirestoreAccessorDriverTests, describeFirestoreQueryDriverTests } from '@dereekb/firebase/test';

describe('firestore client', () => {
  authorizedTestWithMockItemCollection((f) => {
    changeFirestoreLogLevelBeforeAndAfterTests();
    describeFirestoreAccessorDriverTests(f);
  });

  authorizedTestWithMockItemCollection((f) => {
    describeFirestoreQueryDriverTests(f);
  });
});
