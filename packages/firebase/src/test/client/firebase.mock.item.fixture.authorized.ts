import { testWithMockItemFixture } from "../common/firebase.mock.item.fixture";
import { authorizedFirebaseFactory } from "./firebase.authorized";

/**
 * Convenience mock instance for tests within an authorized context.
 */
export const authorizedTestWithMockItemCollection = testWithMockItemFixture()(authorizedFirebaseFactory);
