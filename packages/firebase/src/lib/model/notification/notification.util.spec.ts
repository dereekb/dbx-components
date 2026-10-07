import { type Maybe } from '@dereekb/util';
import { type NotificationBoxRecipient, NotificationBoxRecipientFlag, NotificationDeliveryMethod, NotificationDeliveryMethodDecisionSource, type NotificationUserDefaultNotificationBoxRecipientConfig } from './notification.config';
import { type AppNotificationTemplateTypeInfoRecordService } from './notification.details';
import { type NotificationBoxId, type NotificationBoxSendExclusionList } from './notification.id';
import { type NotificationUser } from './notification';
import {
  effectiveNotificationBoxRecipientConfig,
  mergeNotificationUserNotificationBoxRecipientConfigs,
  notificationExplicitOptInConfigForNotification,
  NotificationUidRecipientDeliveryScope,
  NotificationUidRecipientSuppression,
  resolveNotificationUidRecipientDelivery,
  updateNotificationUserNotificationSendExclusions,
  notificationSendExclusionCanSendFunction
} from './notification.util';

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

describe('effectiveNotificationBoxRecipientConfig()', () => {
  const templateType = 'T';
  const appNotificationTemplateTypeInfoRecordService = { getTemplateTypesForNotificationModel: () => [templateType] } as unknown as AppNotificationTemplateTypeInfoRecordService;

  it('should not copy the global config values other than the lock flag into the box recipient', () => {
    const gc: NotificationUserDefaultNotificationBoxRecipientConfig = { c: { [templateType]: { st: true } }, e: 'gc@example.com', t: '+12345678900', f: NotificationBoxRecipientFlag.OPT_OUT, lk: true };

    const result = effectiveNotificationBoxRecipientConfig({
      uid: 'u',
      m: 'p/1',
      appNotificationTemplateTypeInfoRecordService,
      gc,
      boxConfig: { nb: 'p_1', i: 0, c: { [templateType]: { se: false } }, e: 'box@example.com' },
      recipient: { uid: 'u', i: 0, c: { [templateType]: { sn: false } } }
    });

    expect(result.c[templateType]).toEqual({ se: false });
    expect(result.e).toBe('box@example.com');
    expect(result.t).toBeUndefined();
    expect(result.f).toBeUndefined();
    expect(result.lk).toBe(true);
  });

  describe('flag', () => {
    function resultFlag(boxConfigFlag: Maybe<NotificationBoxRecipientFlag>, recipientFlag: Maybe<NotificationBoxRecipientFlag>) {
      return effectiveNotificationBoxRecipientConfig({
        uid: 'u',
        m: 'p/1',
        appNotificationTemplateTypeInfoRecordService,
        gc: { c: {} },
        boxConfig: { nb: 'p_1', i: 0, c: {}, f: boxConfigFlag },
        recipient: { uid: 'u', i: 0, c: {}, f: recipientFlag }
      }).f;
    }

    it("should copy the box config's opt-out to the box recipient", () => {
      expect(resultFlag(NotificationBoxRecipientFlag.OPT_OUT, undefined)).toBe(NotificationBoxRecipientFlag.OPT_OUT);
    });

    it('should clear the box recipient opt-out once the box config no longer has it', () => {
      expect(resultFlag(undefined, NotificationBoxRecipientFlag.OPT_OUT)).toBeUndefined();
    });

    it('should keep the box recipient disabled flag when the box config has no flag', () => {
      expect(resultFlag(undefined, NotificationBoxRecipientFlag.DISABLED)).toBe(NotificationBoxRecipientFlag.DISABLED);
    });
  });
});

describe('notificationExplicitOptInConfigForNotification()', () => {
  it('should prefer the notification values over the type info values', () => {
    const result = notificationExplicitOptInConfigForNotification({ ois: true, ots: false }, { onlySendToExplicitlyEnabledRecipients: false, onlyTextExplicitlyEnabledRecipients: true });
    expect(result.onlySendToExplicitlyEnabledRecipients).toBe(true);
    expect(result.onlyTextExplicitlyEnabledRecipients).toBe(false);
  });

  it('should fall back to the type info values', () => {
    const result = notificationExplicitOptInConfigForNotification({}, { onlySendToExplicitlyEnabledRecipients: true });
    expect(result.onlySendToExplicitlyEnabledRecipients).toBe(true);
    expect(result.onlyTextExplicitlyEnabledRecipients).toBeUndefined();
  });
});

describe('resolveNotificationUidRecipientDelivery()', () => {
  const notificationTemplateType = 'T';
  const notificationBoxId = 'p_1';

  function notificationUser(input: Partial<Pick<NotificationUser, 'gc' | 'dc' | 'x'>>): Pick<NotificationUser, 'gc' | 'dc' | 'x'> {
    return { gc: { c: {} }, dc: { c: {} }, x: [], ...input };
  }

  function boxRecipient(input?: Partial<NotificationBoxRecipient>): NotificationBoxRecipient {
    return { uid: 'u', i: 0, c: {}, ...input };
  }

  describe('scope', () => {
    it('should be box scope when the recipient has an active box entry', () => {
      const result = resolveNotificationUidRecipientDelivery({ notificationTemplateType, notificationBoxId, boxRecipient: boxRecipient() });
      expect(result.scope).toBe(NotificationUidRecipientDeliveryScope.BOX);
    });

    it('should be direct scope when the box entry is excluded', () => {
      const result = resolveNotificationUidRecipientDelivery({ notificationTemplateType, notificationBoxId, boxRecipient: boxRecipient({ x: true }), listedRecipient: { uid: 'u' } });
      expect(result.scope).toBe(NotificationUidRecipientDeliveryScope.DIRECT);
    });

    it('should be direct scope when there is no box entry', () => {
      const result = resolveNotificationUidRecipientDelivery({ notificationTemplateType, listedRecipient: { uid: 'u' } });
      expect(result.scope).toBe(NotificationUidRecipientDeliveryScope.DIRECT);
    });
  });

  describe('box scope', () => {
    it('should let the global config sd:false beat the box entry se:true', () => {
      const result = resolveNotificationUidRecipientDelivery({
        notificationTemplateType,
        notificationUser: notificationUser({ gc: { c: { [notificationTemplateType]: { sd: false } } } }),
        boxRecipient: boxRecipient({ c: { [notificationTemplateType]: { se: true } } })
      });

      expect(result.decisions[NotificationDeliveryMethod.EMAIL].send).toBe(false);
      expect(result.decisions[NotificationDeliveryMethod.EMAIL].source).toBe(NotificationDeliveryMethodDecisionSource.CONFIG);
      expect(result.decisions[NotificationDeliveryMethod.EMAIL].configIndex).toBe(0);
    });

    it('should still email and summarize a box entry that only disables texts', () => {
      const result = resolveNotificationUidRecipientDelivery({ notificationTemplateType, boxRecipient: boxRecipient({ c: { [notificationTemplateType]: { st: false } } }) });

      expect(result.decisions[NotificationDeliveryMethod.EMAIL].send).toBe(true);
      expect(result.decisions[NotificationDeliveryMethod.NOTIFICATION_SUMMARY].send).toBe(true);
      expect(result.decisions[NotificationDeliveryMethod.TEXT].send).toBe(false);
    });

    it('should ignore the default config', () => {
      const result = resolveNotificationUidRecipientDelivery({
        notificationTemplateType,
        notificationUser: notificationUser({ dc: { c: { [notificationTemplateType]: { st: true } }, dm: [NotificationDeliveryMethod.EMAIL], f: NotificationBoxRecipientFlag.OPT_OUT } }),
        boxRecipient: boxRecipient()
      });

      expect(result.suppression).toBeUndefined();
      expect(result.decisions[NotificationDeliveryMethod.TEXT].send).toBe(false);
      expect(result.decisions[NotificationDeliveryMethod.EMAIL].send).toBe(true);
    });

    it('should use the listed recipient config as the lowest level', () => {
      const result = resolveNotificationUidRecipientDelivery({
        notificationTemplateType,
        boxRecipient: boxRecipient({ c: { [notificationTemplateType]: { se: false } } }),
        listedRecipient: { uid: 'u', se: true, st: true }
      });

      expect(result.decisions[NotificationDeliveryMethod.EMAIL].send).toBe(false);
      expect(result.decisions[NotificationDeliveryMethod.TEXT].send).toBe(true);
      expect(result.decisions[NotificationDeliveryMethod.TEXT].configIndex).toBe(2);
    });

    it('should let a disabled delivery method beat the configs', () => {
      const result = resolveNotificationUidRecipientDelivery({
        notificationTemplateType,
        notificationUser: notificationUser({ gc: { c: { [notificationTemplateType]: { st: true } }, dm: [NotificationDeliveryMethod.TEXT] } }),
        boxRecipient: boxRecipient()
      });

      expect(result.decisions[NotificationDeliveryMethod.TEXT].send).toBe(false);
      expect(result.decisions[NotificationDeliveryMethod.TEXT].source).toBe(NotificationDeliveryMethodDecisionSource.DISABLED_METHOD);
    });
  });

  describe('direct scope', () => {
    it('should rank the global config over the default config over the listed recipient', () => {
      const result = resolveNotificationUidRecipientDelivery({
        notificationTemplateType,
        notificationUser: notificationUser({ gc: { c: { [notificationTemplateType]: { se: false } } }, dc: { c: { [notificationTemplateType]: { se: true, st: true } } } }),
        listedRecipient: { uid: 'u', st: false, sn: false }
      });

      expect(result.decisions[NotificationDeliveryMethod.EMAIL].send).toBe(false);
      expect(result.decisions[NotificationDeliveryMethod.TEXT].send).toBe(true);
      expect(result.decisions[NotificationDeliveryMethod.NOTIFICATION_SUMMARY].send).toBe(false);
    });

    it('should union the global and default disabled delivery methods', () => {
      const result = resolveNotificationUidRecipientDelivery({
        notificationTemplateType,
        notificationUser: notificationUser({ dc: { c: {}, dm: [NotificationDeliveryMethod.EMAIL] } }),
        listedRecipient: { uid: 'u' }
      });

      expect(result.decisions[NotificationDeliveryMethod.EMAIL].source).toBe(NotificationDeliveryMethodDecisionSource.DISABLED_METHOD);
    });

    it('should only email a listed se:true recipient with no config when ois is true (HelloSubs-like listed opt-in)', () => {
      const result = resolveNotificationUidRecipientDelivery({
        notificationTemplateType,
        explicitOptIn: { onlySendToExplicitlyEnabledRecipients: true },
        notificationUser: notificationUser({}),
        listedRecipient: { uid: 'u', se: true }
      });

      expect(result.decisions[NotificationDeliveryMethod.EMAIL].send).toBe(true);
      expect(result.decisions[NotificationDeliveryMethod.NOTIFICATION_SUMMARY].send).toBe(false);
      expect(result.decisions[NotificationDeliveryMethod.TEXT].send).toBe(false);
    });

    it('should resolve a GBE_L-like listed recipient that only gets summaries by default', () => {
      const listedRecipient = { uid: 'u', sn: true, se: false, st: false };

      const defaultResult = resolveNotificationUidRecipientDelivery({ notificationTemplateType, notificationUser: notificationUser({}), listedRecipient });
      expect(defaultResult.decisions[NotificationDeliveryMethod.NOTIFICATION_SUMMARY].send).toBe(true);
      expect(defaultResult.decisions[NotificationDeliveryMethod.EMAIL].send).toBe(false);
      expect(defaultResult.decisions[NotificationDeliveryMethod.TEXT].send).toBe(false);

      const optedInResult = resolveNotificationUidRecipientDelivery({ notificationTemplateType, notificationUser: notificationUser({ gc: { c: { [notificationTemplateType]: { st: true } } } }), listedRecipient });
      expect(optedInResult.decisions[NotificationDeliveryMethod.TEXT].send).toBe(true);
      expect(optedInResult.decisions[NotificationDeliveryMethod.NOTIFICATION_SUMMARY].send).toBe(true);
    });
  });

  describe('suppression', () => {
    it('should suppress a box recipient whose global config opted out', () => {
      const result = resolveNotificationUidRecipientDelivery({ notificationTemplateType, notificationUser: notificationUser({ gc: { c: {}, f: NotificationBoxRecipientFlag.OPT_OUT } }), boxRecipient: boxRecipient() });

      expect(result.suppression).toBe(NotificationUidRecipientSuppression.OPT_OUT);
      expect(result.decisions[NotificationDeliveryMethod.NOTIFICATION_SUMMARY].send).toBe(false);
      expect(result.decisions[NotificationDeliveryMethod.NOTIFICATION_SUMMARY].source).toBe(NotificationDeliveryMethodDecisionSource.SUPPRESSED);
    });

    it('should suppress a direct recipient whose default config opted out', () => {
      const result = resolveNotificationUidRecipientDelivery({ notificationTemplateType, notificationUser: notificationUser({ dc: { c: {}, f: NotificationBoxRecipientFlag.OPT_OUT } }), listedRecipient: { uid: 'u' } });
      expect(result.suppression).toBe(NotificationUidRecipientSuppression.OPT_OUT);
    });

    it('should suppress a recipient whose exclusions exclude the box', () => {
      const result = resolveNotificationUidRecipientDelivery({ notificationTemplateType, notificationBoxId, notificationUser: notificationUser({ x: ['p'] }), boxRecipient: boxRecipient() });
      expect(result.suppression).toBe(NotificationUidRecipientSuppression.EXCLUDED);
    });

    it('should not suppress a recipient whose exclusions do not match the box', () => {
      const result = resolveNotificationUidRecipientDelivery({ notificationTemplateType, notificationBoxId, notificationUser: notificationUser({ x: ['q_1'] }), boxRecipient: boxRecipient() });
      expect(result.suppression).toBeUndefined();
    });
  });

  describe('contact details', () => {
    const authDetails = { email: 'auth@example.com', phoneNumber: '+10000000000', displayName: 'Auth' };

    it('should prefer the global config overrides', () => {
      const result = resolveNotificationUidRecipientDelivery({
        notificationTemplateType,
        notificationUser: notificationUser({ gc: { c: {}, e: 'gc@example.com', t: '+11111111111' }, dc: { c: {}, e: 'dc@example.com', t: '+12222222222' } }),
        listedRecipient: { uid: 'u', e: 'listed@example.com', t: '+13333333333' },
        authDetails
      });

      expect(result.emailAddress).toBe('gc@example.com');
      expect(result.phoneNumber).toBe('+11111111111');
    });

    it('should use the default config overrides in direct scope', () => {
      const result = resolveNotificationUidRecipientDelivery({ notificationTemplateType, notificationUser: notificationUser({ dc: { c: {}, e: 'dc@example.com' } }), listedRecipient: { uid: 'u', e: 'listed@example.com' }, authDetails });
      expect(result.emailAddress).toBe('dc@example.com');
      expect(result.phoneNumber).toBe(authDetails.phoneNumber);
    });

    it('should use the box entry overrides in box scope', () => {
      const result = resolveNotificationUidRecipientDelivery({ notificationTemplateType, notificationUser: notificationUser({ dc: { c: {}, t: '+12222222222' } }), boxRecipient: boxRecipient({ t: '+14444444444' }), authDetails });
      expect(result.phoneNumber).toBe('+14444444444');
    });

    it('should fall back to the listed recipient then the auth details', () => {
      const listed = resolveNotificationUidRecipientDelivery({ notificationTemplateType, listedRecipient: { uid: 'u', e: 'listed@example.com' }, authDetails });
      expect(listed.emailAddress).toBe('listed@example.com');

      const auth = resolveNotificationUidRecipientDelivery({ notificationTemplateType, listedRecipient: { uid: 'u' }, authDetails });
      expect(auth.emailAddress).toBe(authDetails.email);
      expect(auth.name).toBe(authDetails.displayName);
    });
  });
});
