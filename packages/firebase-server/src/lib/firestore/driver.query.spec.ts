import { describeQueryDriverTests } from '@dereekb/firebase';
import { adminTestWithMockItemCollection } from '../../test/firestore.fixture.admin';

adminTestWithMockItemCollection((f) => {
  describeQueryDriverTests(f);
});