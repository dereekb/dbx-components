import { expectFail, itShouldFail } from '@dereekb/util/test';
import { type NotificationTemplateTypeInfo, notificationTemplateTypeInfoRecord, appNotificationTemplateTypeInfoRecordService } from './notification.details';
import { firestoreModelIdentity, firestoreModelKey } from '../../common';

describe('notificationTemplateTypeInfoRecord()', () => {
  itShouldFail('should throw an error if a detail with a duplicate type is provided', () => {
    const detail: NotificationTemplateTypeInfo = {
      type: 'test',
      name: 'test',
      description: 'test',
      notificationModelIdentity: firestoreModelIdentity('test')
    };

    expectFail(() => notificationTemplateTypeInfoRecord([detail, detail]));
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
  });
});
