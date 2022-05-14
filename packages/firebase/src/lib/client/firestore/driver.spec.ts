import { authorizedTestWithMockItemCollection, changeFirestoreLogLevelBeforeAndAfterTests, describeAccessorDriverTests, describeQueryDriverTests } from "@dereekb/firebase/test";

describe('firestore client', () => {

  authorizedTestWithMockItemCollection((f) => {
    changeFirestoreLogLevelBeforeAndAfterTests();
    describeAccessorDriverTests(f);
  });

  authorizedTestWithMockItemCollection((f) => {
    describeQueryDriverTests(f);
  });

});
