import { type NotificationUser, notificationUserConverter } from './notification';

describe('notificationUserConverter', () => {
  function notificationUser(input?: Partial<NotificationUser>): NotificationUser {
    return { uid: 'u', b: [], x: [], gc: { c: {} }, dc: { c: {} }, bc: [], ...input };
  }

  describe('tso', () => {
    it('should round-trip the stopped phone numbers', () => {
      const data = notificationUserConverter.mapFunctions.to(notificationUser({ tso: ['+15555550100', '+15555550101'] }));
      const restored = notificationUserConverter.mapFunctions.from(data);

      expect(restored.tso).toEqual(['+15555550100', '+15555550101']);
    });

    it('should filter duplicate phone numbers', () => {
      const data = notificationUserConverter.mapFunctions.to(notificationUser({ tso: ['+15555550100', '+15555550100'] }));
      expect(data.tso).toEqual(['+15555550100']);
    });

    it('should not store an empty list', () => {
      const data = notificationUserConverter.mapFunctions.to(notificationUser({ tso: [] }));
      expect(data.tso).toBeNull();
    });
  });
});
