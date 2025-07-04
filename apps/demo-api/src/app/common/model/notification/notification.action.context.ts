import { NotificationSendService, NotificationSendServiceRef, NotificationTaskService, NotificationTaskServiceRef, NotificationTemplateService, NotificationTemplateServiceRef } from '@dereekb/firebase-server/model';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { AppNotificationTemplateTypeInfoRecordServiceRef } from '@dereekb/firebase';

export abstract class DemoFirebaseServerActionsContextWithNotificationServices extends DemoFirebaseServerActionsContext implements NotificationTemplateServiceRef, NotificationSendServiceRef, NotificationTaskServiceRef, AppNotificationTemplateTypeInfoRecordServiceRef {
  abstract readonly notificationTemplateService: NotificationTemplateService;
  abstract readonly notificationSendService: NotificationSendService;
  abstract readonly notificationTaskService: NotificationTaskService;
}
