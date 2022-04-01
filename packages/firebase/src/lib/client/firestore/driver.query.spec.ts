import { authorizedTestWithMockItemCollection } from "packages/firebase/src/test/client/firestore.mock.item.fixture.authorized";
import { describeQueryDriverTests } from "packages/firebase/src/test/common/test.driver.factory";

describe('firestoreClientQueryDriver', () => {

  authorizedTestWithMockItemCollection((f) => {

    describeQueryDriverTests(f);

  });

});
