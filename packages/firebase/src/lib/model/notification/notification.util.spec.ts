import { NotificationBoxRecipientFlag } from './notification.config';
import { NotificationBoxId, NotificationBoxSendExclusionList } from './notification.id';
import { mergeNotificationUserNotificationBoxRecipientConfigs, updateNotificationUserNotificationSendExclusions , notificationSendExclusionCanSendFunction } from './notification.util';

describe('updateNotificationUserNotificationSendExclusions()', () => {
  it('should not add any exclusions that do not match any associated notification boxes', () => {
    const b: NotificationBoxId[] = []; // no associations
    const x: NotificationBoxSendExclusionList = [];

    const result = updateNotificationUserNotificationSendExclusions({
      notificationUser: {
        b,
        x,
        bc: []
      },
      addExclusions: ['b_123', 'b_123_c_123']
    });

    expect(result.update.x).toEqual([]);
  });

  it('should add all exclusions that match any associated notification boxes', () => {
    const parent = 'a_123';
    const child = `${parent}_b_123`;
    const childChild = `${child}_c_123`;

    const b: NotificationBoxId[] = [parent, child, childChild];
    const x: NotificationBoxSendExclusionList = [];

    const result = updateNotificationUserNotificationSendExclusions({
      notificationUser: {
        b,
        x,
        bc: []
      },
      addExclusions: [parent]
    });

    expect(result.update.x).toEqual([parent]);
  });

  it('should update the existing exclusions to remove any exclusion that does not match any associated notification boxes', () => {
    const noLongerAssociated = 'b_123';
    const parent = 'a_123';
    const child = `${parent}_b_123`;
    const childChild = `${child}_c_123`;

    const b: NotificationBoxId[] = [parent, child, childChild];
    const x: NotificationBoxSendExclusionList = [parent, noLongerAssociated];

    const result = updateNotificationUserNotificationSendExclusions({
      notificationUser: {
        b,
        x,
        bc: []
      }
    });

    expect(result.update.x).toEqual([parent]);
  });

  it('should remove any exclusions that match any associated notification boxes', () => {
    const parent = 'a_123';
    const child = `${parent}_b_123`;
    const childChild = `${child}_c_123`;

    const b: NotificationBoxId[] = [parent, child, childChild];
    const x: NotificationBoxSendExclusionList = [parent];

    const result = updateNotificationUserNotificationSendExclusions({
      notificationUser: {
        b,
        x,
        bc: []
      },
      removeExclusions: [parent]
    });

    expect(result.update.x).toEqual([]);
  });
});

describe('notificationSendExclusionCanSendFunction()', () => {
  it('should return false if the notification is excluded', () => {
    const parent: NotificationBoxId = 'a_123';
    const child: NotificationBoxId = 'a_123_b_415';
    const childChild: NotificationBoxId = 'a_123_b_415_c_1';

    const exclusions: NotificationBoxSendExclusionList = [parent];
    const fn = notificationSendExclusionCanSendFunction(exclusions);

    expect(fn(parent)).toBe(false);
    expect(fn(child)).toBe(false);
    expect(fn(childChild)).toBe(false);
  });

  it('should return true if the notification is not excluded', () => {
    const parent: NotificationBoxId = 'a_123';

    const exclusions: NotificationBoxSendExclusionList = [parent];
    const fn = notificationSendExclusionCanSendFunction(exclusions);

    expect(fn('b_123')).toBe(true);
    expect(fn('b_123_c_123')).toBe(true);
  });

  it('should return true if the notification list is empty', () => {
    const exclusions: NotificationBoxSendExclusionList = [];
    const fn = notificationSendExclusionCanSendFunction(exclusions);

    expect(fn('a_123')).toBe(true);
    expect(fn('b_123')).toBe(true);
  });
});

describe('mergeNotificationUserNotificationBoxRecipientConfigs()', () => {
  it('should retain the user-only config values', () => {
    const nb = '0';

    const mergeResult = mergeNotificationUserNotificationBoxRecipientConfigs(
      {
        f: NotificationBoxRecipientFlag.OPT_OUT,
        nb,
        rm: true,
        ns: true,
        lk: true,
        bk: true,
        c: {},
        i: 0
      },
      {
        f: NotificationBoxRecipientFlag.ENABLED,
        rm: false,
        ns: false,
        lk: false,
        bk: false
      }
    );

    expect(mergeResult.f).toBe(NotificationBoxRecipientFlag.OPT_OUT);
    expect(mergeResult.nb).toBe(nb);
    expect(mergeResult.rm).toBe(true);
    expect(mergeResult.ns).toBe(true);
    expect(mergeResult.lk).toBe(true);
    expect(mergeResult.bk).toBe(true);
    expect(mergeResult.i).toBe(0);
  });
});
