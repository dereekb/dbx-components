import { authorizedTestWithMockItemCollection } from "../../../test/client/firestore.mock.item.fixture.authorized";
import { describeAccessorDriverTests } from "../../../test/common/test.driver.accessor";
import { changeFirestoreLogLevelBeforeAndAfterTests } from "packages/firebase/src/test/client/firestore";
import { describeQueryDriverTests } from "../../../test/common/test.driver.query";

describe('firestore client', () => {

  authorizedTestWithMockItemCollection((f) => {
    changeFirestoreLogLevelBeforeAndAfterTests();
    describeAccessorDriverTests(f);
  });

  authorizedTestWithMockItemCollection((f) => {
    describeQueryDriverTests(f);
  });

});
