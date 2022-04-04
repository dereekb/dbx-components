import { authorizedTestWithMockItemCollection } from "../../../test/client/firestore.mock.item.fixture.authorized";
import { describeAccessorDriverTests } from "../../../test/common/test.driver.accessor";
import { setLogLevel } from '@firebase/firestore';
import { changeFirestoreLogLevelBeforeAndAfterTests } from "packages/firebase/src/test/client/firestore";

authorizedTestWithMockItemCollection((f) => {
  changeFirestoreLogLevelBeforeAndAfterTests();
  describeAccessorDriverTests(f);
});
