import { NotificationBoxRecipientFlag } from './notification.config';
import { updateNotificationUserDefaultNotificationBoxRecipientConfig, updateNotificationUserNotificationBoxRecipientConfigIfChanged } from './notification.api.util';

describe('updateNotificationUserDefaultNotificationBoxRecipientConfig()', () => {
  it('should remove the flagged types from the old config', () => {
    const oldConfig = {
      se: false
    };

    const expectedConfig = oldConfig;

    const result = updateNotificationUserDefaultNotificationBoxRecipientConfig(
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
            type: 'b',
            remove: true
          }
        ]
      }
    );

    expect(result.f).toBe(NotificationBoxRecipientFlag.ENABLED);
    expect(result.c).toEqual({
      a: expectedConfig
    });
  });

  it('should insert the new items into the old config', () => {
    const oldConfig = {
      se: false
    };

    const expectedConfig = {
      se: true,
      sn: false,
      sp: true,
      st: false
    };

    const result = updateNotificationUserDefaultNotificationBoxRecipientConfig(
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

    expect(result.f).toBe(NotificationBoxRecipientFlag.ENABLED);
    expect(result.c).toEqual({
      a: expectedConfig,
      b: {}
    });
  });

  it('should insert the new items into the old config and remove items flagged for remove', () => {
    const oldConfig = {
      se: false
    };

    const expectedConfig = {
      se: true,
      sn: false,
      sp: true,
      st: false
    };

    const result = updateNotificationUserDefaultNotificationBoxRecipientConfig(
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
          },
          {
            type: 'b',
            remove: true
          }
        ]
      }
    );

    expect(result.f).toBe(NotificationBoxRecipientFlag.ENABLED);
    expect(result.c).toEqual({
      a: expectedConfig
    });
  });
});

describe('updateNotificationUserNotificationBoxRecipientConfigIfChanged()', () => {
  it('should return undefined if no changes occur', () => {
    const result = updateNotificationUserNotificationBoxRecipientConfigIfChanged(
      {
        nb: 'a',
        i: 0,
        ns: undefined,
        c: {
          ['a']: {}
        }
      },
      {
        nb: 'a',
        configs: [
          {
            type: 'a'
          }
        ]
      }
    );

    expect(result).toBeUndefined();
  });
});
