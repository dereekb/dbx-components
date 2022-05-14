import { describeQueryDriverTests, describeAccessorDriverTests } from "@dereekb/firebase/test";
import { adminTestWithMockItemCollection } from "@dereekb/firebase-server/test";

describe('firestore server', () => {

  adminTestWithMockItemCollection((f) => {
    describeAccessorDriverTests(f);
  });

  adminTestWithMockItemCollection((f) => {
    describeQueryDriverTests(f);
  });

});
