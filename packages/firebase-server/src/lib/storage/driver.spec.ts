import { authorizedTestWithMockItemStorage, describeFirebaseStorageAccessorDriverTests } from '@dereekb/firebase/test';
import { dbxComponentsAdminTestWithMockItemCollection } from '@dereekb/firebase-server/test';

describe('firebase storage server', () => {
  authorizedTestWithMockItemStorage((f) => {
    describeFirebaseStorageAccessorDriverTests(f);
  });
});
