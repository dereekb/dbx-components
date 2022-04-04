import { authorizedTestWithMockItemCollection } from "../../../test/client/firestore.mock.item.fixture.authorized";
import { describeAccessorDriverTests } from "../../../test/common/test.driver.accessor";

authorizedTestWithMockItemCollection((f) => {
  describeAccessorDriverTests(f);
});
