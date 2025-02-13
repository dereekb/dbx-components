import { firestoreDummyKey } from '../../common';
import { NotificationBoxRecipientFlag, NotificationUserNotificationBoxRecipientConfig } from './notification.config';
import { mergeNotificationUserNotificationBoxRecipientConfigs } from './notification.util';

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
