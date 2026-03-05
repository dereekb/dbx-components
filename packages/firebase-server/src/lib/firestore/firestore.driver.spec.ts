import { describeFirestoreQueryDriverTests, describeFirestoreAccessorDriverTests, describeFirestoreDocumentUtilityTests } from '@dereekb/firebase/test';
import { dbxComponentsAdminTestWithMockItemCollection } from '@dereekb/firebase-server/test';

describe('firestore server', () => {
  dbxComponentsAdminTestWithMockItemCollection((f) => {
    describeFirestoreAccessorDriverTests(f);
    describeFirestoreQueryDriverTests(f);
    describeFirestoreDocumentUtilityTests(f);
  });
});
