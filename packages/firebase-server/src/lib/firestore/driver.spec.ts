import { describeQueryDriverTests, describeAccessorDriverTests } from "@dereekb/firebase/test";
import { adminTestWithMockItemCollection } from "@dereekb/firebase-server/test";

jest.setTimeout(9000);

describe('firestore server', () => {

  adminTestWithMockItemCollection((f) => {
    describeAccessorDriverTests(f);
  });

  adminTestWithMockItemCollection((f) => {
    describeQueryDriverTests(f);
  });

});
