import { authorizedTestWithMockItemStorage, describeFirebaseStorageAccessorDriverTests } from '@dereekb/firebase/test';

describe('firebase storage client', () => {
  authorizedTestWithMockItemStorage((f) => {
    describeFirebaseStorageAccessorDriverTests(f);
  });
});
