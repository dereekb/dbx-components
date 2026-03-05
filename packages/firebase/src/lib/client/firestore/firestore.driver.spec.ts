import { authorizedTestWithMockItemCollection, changeFirestoreLogLevelBeforeAndAfterTests, describeFirestoreAccessorDriverTests, describeFirestoreDocumentUtilityTests, describeFirestoreQueryDriverTests } from '@dereekb/firebase/test';

describe('firestore client', () => {
  authorizedTestWithMockItemCollection((f) => {
    changeFirestoreLogLevelBeforeAndAfterTests();
    describeFirestoreAccessorDriverTests(f);
    describeFirestoreQueryDriverTests(f);
    describeFirestoreDocumentUtilityTests(f);
  });
});
