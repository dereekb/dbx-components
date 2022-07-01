import { testWithMockItemFixture } from '../common/firestore/firestore.mock.item.fixture';
import { authorizedFirestoreFactory } from './firestore.authorized';

/**
 * Convenience mock instance for tests within an authorized context.
 *
 * Uses @firestore/firebase. This is ONLY for the client.
 */
export const authorizedTestWithMockItemCollection = testWithMockItemFixture()(authorizedFirestoreFactory);
