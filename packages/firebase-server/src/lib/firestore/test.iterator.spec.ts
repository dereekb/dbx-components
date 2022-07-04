import { describeFirestoreIterationTests } from '@dereekb/firebase/test';
import { dbxComponentsAdminTestWithMockItemCollection } from '@dereekb/firebase-server/test';

dbxComponentsAdminTestWithMockItemCollection((f) => {
  describeFirestoreIterationTests(f);
});
