import { describeAccessorDriverTests } from "@dereekb/firebase";
import { adminTestWithMockItemCollection } from "../../test/firestore.fixture.admin";

adminTestWithMockItemCollection((f) => {
  describeAccessorDriverTests(f);
});
