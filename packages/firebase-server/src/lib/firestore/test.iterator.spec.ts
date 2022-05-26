import { describeFirestoreIterationTests } from '@dereekb/firebase/test';
import { adminTestWithMockItemCollection } from '@dereekb/firebase-server/test';

adminTestWithMockItemCollection((f) => {
  describeFirestoreIterationTests(f);
});
