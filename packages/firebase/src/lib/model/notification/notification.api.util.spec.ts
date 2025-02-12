import { NotificationBoxRecipientFlag, NotificationUserNotificationBoxRecipientConfig } from './notification.config';
import { updateNotificationUserDefaultNotificationBoxRecipientConfig } from './notification.api.util';

describe('updateNotificationUserDefaultNotificationBoxRecipientConfig()', () => {
  it('should replace the c value', () => {
    const oldConfig = {
      se: false
    };

    const expectedConfig = {
      se: true,
      sn: false,
      sp: true,
      st: false
    };

    const mergeResult = updateNotificationUserDefaultNotificationBoxRecipientConfig(
      {
        c: {
          ['a']: oldConfig,
          ['b']: {}
        },
        f: NotificationBoxRecipientFlag.ENABLED
      },
      {
        configs: [
          {
            type: 'a',
            ...expectedConfig
          }
        ]
      }
    );

    expect(mergeResult.f).toBe(NotificationBoxRecipientFlag.ENABLED);
    expect(mergeResult.c).toEqual({
      a: expectedConfig
    });
  });
});
