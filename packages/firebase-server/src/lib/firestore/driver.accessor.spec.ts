import { describeAccessorDriverTests } from "@dereekb/firebase";
import { adminTestWithMockItemCollection } from "../../test/firestore/firestore.fixture.admin";

adminTestWithMockItemCollection((f) => {
  describeAccessorDriverTests(f);
});
