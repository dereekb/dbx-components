import { NotificationBoxRecipientFlag, NotificationDeliveryMethod, type NotificationUserDefaultNotificationBoxRecipientConfig } from './notification.config';
import { type UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams } from './notification.api';
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

  describe('configs', () => {
    const existing: NotificationUserDefaultNotificationBoxRecipientConfig = { c: { a: { se: false, sn: true }, b: { st: true } } };

    it('should only change the values an entry sets', () => {
      const result = updateNotificationUserDefaultNotificationBoxRecipientConfig(existing, { configs: [{ type: 'a', st: true }] });
      expect(result.c).toEqual({ a: { se: false, sn: true, st: true }, b: { st: true } });
    });

    it('should keep the existing value when an entry leaves it undefined', () => {
      const result = updateNotificationUserDefaultNotificationBoxRecipientConfig(existing, { configs: [{ type: 'a', se: undefined, st: true }] });
      expect(result.c['a']).toEqual({ se: false, sn: true, st: true });
    });

    it('should clear a value set to null', () => {
      const result = updateNotificationUserDefaultNotificationBoxRecipientConfig(existing, { configs: [{ type: 'a', se: null }] });
      expect(result.c).toEqual({ a: { se: null, sn: true }, b: { st: true } });
    });

    it('should remove a type the update leaves with no values set', () => {
      const result = updateNotificationUserDefaultNotificationBoxRecipientConfig(existing, { configs: [{ type: 'a', se: null, sn: null }] });
      expect(result.c).toEqual({ b: { st: true } });
    });

    it('should not add a new type with no values set', () => {
      const result = updateNotificationUserDefaultNotificationBoxRecipientConfig(existing, { configs: [{ type: 'c', st: null }] });
      expect(result.c).toEqual(existing.c);
    });
  });

  describe('dm', () => {
    const existing: NotificationUserDefaultNotificationBoxRecipientConfig = { c: {}, dm: [NotificationDeliveryMethod.TEXT] };

    it('should keep the existing dm when the update leaves it undefined', () => {
      const result = updateNotificationUserDefaultNotificationBoxRecipientConfig(existing, {});
      expect(result.dm).toEqual([NotificationDeliveryMethod.TEXT]);
    });

    it('should clear dm when the update passes null', () => {
      const result = updateNotificationUserDefaultNotificationBoxRecipientConfig(existing, { dm: null });
      expect(result.dm).toBeNull();
    });

    it('should store an empty dm as null', () => {
      const result = updateNotificationUserDefaultNotificationBoxRecipientConfig(existing, { dm: [] });
      expect(result.dm).toBeNull();
    });

    it('should replace dm with the canonicalized list', () => {
      const result = updateNotificationUserDefaultNotificationBoxRecipientConfig(existing, { dm: [NotificationDeliveryMethod.NOTIFICATION_SUMMARY, NotificationDeliveryMethod.EMAIL, NotificationDeliveryMethod.EMAIL] });
      expect(result.dm).toEqual([NotificationDeliveryMethod.EMAIL, NotificationDeliveryMethod.NOTIFICATION_SUMMARY]);
    });
  });

  describe('tcat', () => {
    const tcat = new Date('2026-01-02T03:04:05Z');

    it('should keep the existing tcat', () => {
      const result = updateNotificationUserDefaultNotificationBoxRecipientConfig({ c: {}, tcat }, { configs: [{ type: 'a', st: true }] });
      expect(result.tcat).toBe(tcat);
    });

    it('should ignore a tcat passed in through a cast', () => {
      const forged = { tcat: new Date('2020-01-01T00:00:00Z') } as UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams;

      expect(updateNotificationUserDefaultNotificationBoxRecipientConfig({ c: {}, tcat }, forged).tcat).toBe(tcat);
      expect(updateNotificationUserDefaultNotificationBoxRecipientConfig({ c: {} }, forged).tcat).toBeUndefined();
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
