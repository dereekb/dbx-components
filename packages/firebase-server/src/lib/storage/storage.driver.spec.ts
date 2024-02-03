import { describeFirebaseStorageAccessorDriverTests } from '@dereekb/firebase/test';
import { dbxComponentsAdminTestWithMockItemStorage } from '@dereekb/firebase-server/test';

describe('firebase storage server', () => {
  dbxComponentsAdminTestWithMockItemStorage((f) => {
    describeFirebaseStorageAccessorDriverTests(f);
  });
});
