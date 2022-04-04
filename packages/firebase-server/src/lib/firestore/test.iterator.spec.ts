import { describeFirestoreIterationTests } from "@dereekb/firebase";
import { adminTestWithMockItemCollection } from "../../test/firestore.fixture.admin";

adminTestWithMockItemCollection((f) => {
  describeFirestoreIterationTests(f);
});
