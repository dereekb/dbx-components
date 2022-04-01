import { describeQueryDriverTests } from '@dereekb/firebase';
import { adminTestWithMockItemCollection } from '../../test/firestore.fixture.admin';

describe('googleCloudFirestoreQueryDriver', () => {

  adminTestWithMockItemCollection((f) => {

    describeQueryDriverTests(f);

  });

});
