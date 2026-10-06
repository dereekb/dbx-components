import { expectFail, itShouldFail } from '@dereekb/util/test';
import { type NotificationTemplateTypeInfo, type NotificationTemplateTypeInfoGroup, notificationTemplateTypeInfoRecord, appNotificationTemplateTypeInfoRecordService, notificationTemplateTypeInfoUserConfigurableDeliveryMethods, DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS } from './notification.details';
import { NotificationDeliveryMethod } from './notification.config';
import { firestoreModelIdentity, firestoreModelKey } from '../../common';

describe('notificationTemplateTypeInfoRecord()', () => {
  itShouldFail('should throw an error if a detail with a duplicate type is provided', () => {
    const detail: NotificationTemplateTypeInfo = {
      type: 'test',
      name: 'test',
      description: 'test',
      notificationModelIdentity: firestoreModelIdentity('test')
    };

    void expectFail(() => notificationTemplateTypeInfoRecord([detail, detail]));
  });
});

const testIdentityA = firestoreModelIdentity('a');
const testIdentityATarget = firestoreModelIdentity('atar');
const testIdentityAlternative = firestoreModelIdentity('ab');
const testIdentityAlternativeTarget = firestoreModelIdentity('abtar');

describe('appNotificationTemplateTypeInfoRecordService()', () => {
  describe('alternative model types', () => {
    const record = notificationTemplateTypeInfoRecord([
      {
        type: 'aonlynotarget',
        name: 'aonly no target',
        description: 'aonly no target',
        notificationModelIdentity: testIdentityA
      },
      {
        type: 'aonly',
        name: 'aonly',
        description: 'aonly',
        notificationModelIdentity: testIdentityA,
        targetModelIdentity: testIdentityATarget
      },
      {
        type: 'alt',
        name: 'test alternative',
        description: 'test alternative',
        notificationModelIdentity: testIdentityA,
        targetModelIdentity: testIdentityATarget,
        alternativeModelIdentities: [
          {
            altNotificationModelIdentity: testIdentityAlternative,
            altTargetModelIdentity: testIdentityAlternativeTarget
          }
        ]
      },
      {
        type: 'altb',
        name: 'test alternative no target',
        description: 'test alternative',
        notificationModelIdentity: testIdentityA,
        alternativeModelIdentities: [
          {
            altNotificationModelIdentity: testIdentityAlternative
          }
        ]
      },
      {
        type: 'altnoalttarget',
        name: 'test alternative with no alt target',
        description: 'test alternative with no alt target',
        notificationModelIdentity: testIdentityA,
        targetModelIdentity: testIdentityATarget,
        alternativeModelIdentities: [
          {
            altNotificationModelIdentity: testIdentityAlternative
          }
        ]
      }
    ]);

    it('should register the alternative model types along with the notification type', () => {
      const service = appNotificationTemplateTypeInfoRecordService(record);

      const allIdentities = service.getAllNotificationModelIdentityValues();
      expect(allIdentities).toContain(testIdentityAlternative);

      const notificationModelIdentities = service.getAllNotificationModelIdentityValues();
      expect(notificationModelIdentities).toContain(testIdentityA);
      expect(notificationModelIdentities).not.toContain(testIdentityATarget);
      expect(notificationModelIdentities).toContain(testIdentityAlternative);
      expect(notificationModelIdentities).not.toContain(testIdentityAlternativeTarget);

      const typesForTargetModel = service.getTemplateTypesForTargetModel(firestoreModelKey(testIdentityAlternativeTarget, '0'));
      expect(typesForTargetModel).toHaveLength(1);
    });

    it('should use the default target model type for alternative types with no alternative target type', () => {
      const service = appNotificationTemplateTypeInfoRecordService(record);

      const allIdentities = service.getAllNotificationModelIdentityValues();
      expect(allIdentities).toContain(testIdentityAlternative);

      const typesForTargetModel = service.getTemplateTypeInfosForTargetModelIdentity(testIdentityATarget);
      expect(typesForTargetModel).toHaveLength(4);
    });
  });
});

describe('notificationTemplateTypeInfoUserConfigurableDeliveryMethods()', () => {
  it('should return the default methods when none are configured', () => {
    const result = notificationTemplateTypeInfoUserConfigurableDeliveryMethods({});

    expect(result).toBe(DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS);
    expect(result).toEqual([NotificationDeliveryMethod.EMAIL, NotificationDeliveryMethod.TEXT, NotificationDeliveryMethod.NOTIFICATION_SUMMARY]);
    expect(result).not.toContain(NotificationDeliveryMethod.PUSH);
  });

  it('should return the configured methods', () => {
    expect(notificationTemplateTypeInfoUserConfigurableDeliveryMethods({ userConfigurableDeliveryMethods: [NotificationDeliveryMethod.EMAIL] })).toEqual([NotificationDeliveryMethod.EMAIL]);
  });
});

describe('appNotificationTemplateTypeInfoRecordService() groups', () => {
  const groupA: NotificationTemplateTypeInfoGroup = { key: 'a', name: 'Group A', sortOrder: 0 };

  function makeInfo(type: string, extra?: Partial<NotificationTemplateTypeInfo>): NotificationTemplateTypeInfo {
    return { type, name: type, description: type, notificationModelIdentity: testIdentityA, ...extra };
  }

  it('should keep the group, hidden and method metadata on the type info', () => {
    const service = appNotificationTemplateTypeInfoRecordService(notificationTemplateTypeInfoRecord([makeInfo('x', { group: groupA, sortOrder: 1, userConfigurableDeliveryMethods: [NotificationDeliveryMethod.EMAIL] }), makeInfo('y', { group: groupA, hideFromUserSettings: true })]));

    const [x, y] = service.getAllKnownTemplateTypeInfo();

    expect(x.group).toBe(groupA);
    expect(x.sortOrder).toBe(1);
    expect(x.userConfigurableDeliveryMethods).toEqual([NotificationDeliveryMethod.EMAIL]);
    expect(y.group).toBe(groupA);
    expect(y.hideFromUserSettings).toBe(true);
  });

  it('should allow equal group definitions that share a key', () => {
    expect(() => appNotificationTemplateTypeInfoRecordService(notificationTemplateTypeInfoRecord([makeInfo('x', { group: groupA }), makeInfo('y', { group: { ...groupA } })]))).not.toThrow();
  });

  it('should throw if two groups that share a key have different definitions', () => {
    expect(() => appNotificationTemplateTypeInfoRecordService(notificationTemplateTypeInfoRecord([makeInfo('x', { group: groupA }), makeInfo('y', { group: { ...groupA, name: 'Other' } })]))).toThrow();
  });
});
