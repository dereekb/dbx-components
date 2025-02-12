import { NotificationSendService, NotificationTemplateService, NotificationTemplateServiceRef } from '@dereekb/firebase-server/model';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { AppNotificationTemplateTypeDetailsRecordService, NotificationTemplateTypeDetailsRecord } from '@dereekb/firebase';
import { AppNotificationTemplateTypeDetailsRecordServiceRef } from '@dereekb/firebase';

export abstract class DemoFirebaseServerActionsContextWithNotificationServices extends DemoFirebaseServerActionsContext implements NotificationTemplateServiceRef, AppNotificationTemplateTypeDetailsRecordServiceRef {
  abstract readonly appNotificationTemplateTypeDetailsRecordService: AppNotificationTemplateTypeDetailsRecordService;
  abstract readonly notificationTemplateService: NotificationTemplateService;
  abstract readonly notificationSendService: NotificationSendService;
}
