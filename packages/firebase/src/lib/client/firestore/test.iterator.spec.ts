import { authorizedTestWithMockItemCollection, describeFirestoreIterationTests } from '@dereekb/firebase/test';

authorizedTestWithMockItemCollection((f) => {
  describeFirestoreIterationTests(f);
});
