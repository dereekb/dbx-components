import { NotificationSendService, NotificationTaskService, firestoreNotificationSummarySendService, ignoreSendNotificationTextSendService } from '@dereekb/firebase-server/model';
import { demoNotificationMailgunSendService } from './notification.send.mailgun.service';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { DEMO_API_NOTIFICATION_SUMMARY_ID_FOR_UID } from 'demo-firebase';

export function demoNotificationTaskServiceFactory(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext): NotificationTaskService {
  const notificationSendService: NotificationTaskService = {
    isKnownNotificationTaskType: () => false,
    taskHandlerForNotificationTaskType: () => ({
      async handleNotificationTask(notificationTask) {
        return {
          completion: false // TODO: ...
        };
      }
    })
  };

  return notificationSendService;
}
