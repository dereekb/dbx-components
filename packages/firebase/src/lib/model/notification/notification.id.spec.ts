import { firestoreModelIdentity } from '../../common';
import { notificationSummaryIdForUidFunctionForRootFirestoreModelIdentity } from './notification.id';

describe('notificationSummaryIdForUidFunctionForRootFirestoreModelIdentity()', () => {
  describe('function', () => {
    const testCollection = 't';
    const testIdentity = firestoreModelIdentity('test', 't');
    const fn = notificationSummaryIdForUidFunctionForRootFirestoreModelIdentity(testIdentity);

    it('should create a NotificationSummaryId for the input uid', () => {
      const uid = 'uid';
      const result = fn(uid);
      expect(result).toBe(`${testCollection}_${uid}`);
    });
  });
});
