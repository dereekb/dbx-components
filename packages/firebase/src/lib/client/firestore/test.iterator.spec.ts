import { authorizedTestWithMockItemCollection } from "../../../test";
import { describeFirestoreIterationTests } from "../../../test/common/test.iterator";

authorizedTestWithMockItemCollection((f) => {
  describeFirestoreIterationTests(f);
});
