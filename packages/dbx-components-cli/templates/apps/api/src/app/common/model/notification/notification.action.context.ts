import { type NotificationSendService, type NotificationSendServiceRef, type NotificationTaskService, type NotificationTaskServiceRef, type NotificationTemplateService, type NotificationTemplateServiceRef } from '@dereekb/firebase-server/model';
import { APP_CODE_PREFIXFirebaseServerActionsContext } from '../../firebase/action.context';
import { type AppNotificationTemplateTypeInfoRecordServiceRef } from '@dereekb/firebase';

export abstract class APP_CODE_PREFIXFirebaseServerActionsContextWithNotificationServices extends APP_CODE_PREFIXFirebaseServerActionsContext implements NotificationTemplateServiceRef, NotificationSendServiceRef, NotificationTaskServiceRef, AppNotificationTemplateTypeInfoRecordServiceRef {
  abstract readonly notificationTemplateService: NotificationTemplateService;
  abstract readonly notificationSendService: NotificationSendService;
  abstract readonly notificationTaskService: NotificationTaskService;
}
