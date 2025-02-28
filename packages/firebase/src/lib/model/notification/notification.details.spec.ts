import { expectFail, itShouldFail } from '@dereekb/util/test';
import { type NotificationTemplateTypeInfo, notificationTemplateTypeDetailsRecord } from './notification.details';
import { firestoreModelIdentity } from '../../common';

describe('notificationTemplateTypeDetailsRecord()', () => {
  itShouldFail('should throw an error if a detail with a duplicate type is provided', () => {
    const detail: NotificationTemplateTypeInfo = {
      type: 'test',
      name: 'test',
      description: 'test',
      notificationModelIdentity: firestoreModelIdentity('test')
    };

    expectFail(() => notificationTemplateTypeDetailsRecord([detail, detail]));
  });
});
