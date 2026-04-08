import { type NotificationSendService, firestoreNotificationSummarySendService, ignoreSendNotificationTextSendService } from '@dereekb/firebase-server/model';
import { demoNotificationMailgunSendService } from './notification.send.mailgun.service';
import { type DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { DEMO_API_NOTIFICATION_SUMMARY_ID_FOR_UID } from 'demo-firebase';

/**
 * Assembles the composite NotificationSendService for the demo API,
 * wiring together Mailgun email delivery, a no-op text service, and
 * Firestore-backed notification summary persistence.
 *
 * @param demoFirebaseServerActionsContext - server actions context providing the Mailgun service and Firestore access
 * @returns a fully configured NotificationSendService for the demo app
 */
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
