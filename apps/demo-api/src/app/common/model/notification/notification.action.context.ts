import { NotificationSendService, NotificationTemplateService, NotificationTemplateServiceRef } from '@dereekb/firebase-server/model';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';

export abstract class DemoFirebaseServerActionsContextWithNotificationServices extends DemoFirebaseServerActionsContext implements NotificationTemplateServiceRef {
  abstract readonly notificationTemplateService: NotificationTemplateService;
  abstract readonly notificationSendService: NotificationSendService;
}
