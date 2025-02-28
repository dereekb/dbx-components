import { NotificationSendService, firestoreNotificationSummarySendService, ignoreSendNotificationTextSendService } from '@dereekb/firebase-server/model';
import { demoNotificationMailgunSendService } from './notification.send.mailgun.service';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { DEMO_API_NOTIFICATION_SUMMARY_ID_FOR_UID } from '@dereekb/demo-firebase';

export function demoNotificationSendServiceFactory(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext): NotificationSendService {
  const { mailgunService } = demoFirebaseServerActionsContext;

  const emailSendService = demoNotificationMailgunSendService(mailgunService);
  const notificationSummarySendService = firestoreNotificationSummarySendService({
    context: demoFirebaseServerActionsContext
  });

  const notificationSendService: NotificationSendService = {
    emailSendService,
    textSendService: ignoreSendNotificationTextSendService(),
    notificationSummarySendService,
    notificationSummaryIdForUidFunction: DEMO_API_NOTIFICATION_SUMMARY_ID_FOR_UID
  };

  return notificationSendService;
}
