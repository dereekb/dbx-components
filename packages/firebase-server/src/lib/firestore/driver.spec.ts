import { describeQueryDriverTests, describeAccessorDriverTests } from "@dereekb/firebase";
import { adminTestWithMockItemCollection } from "../../test/firestore/firestore.fixture.admin";

describe('firestore server', () => {

  adminTestWithMockItemCollection((f) => {
    describeAccessorDriverTests(f);
  });

  adminTestWithMockItemCollection((f) => {
    describeQueryDriverTests(f);
  });

});
