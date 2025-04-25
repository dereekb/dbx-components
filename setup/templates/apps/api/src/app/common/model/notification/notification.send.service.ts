import { NotificationSendService, firestoreNotificationSummarySendService, ignoreSendNotificationTextSendService } from '@dereekb/firebase-server/model';
import { APP_CODE_PREFIXNotificationMailgunSendService } from './notification.send.mailgun.service';
import { APP_CODE_PREFIXFirebaseServerActionsContext } from '../../firebase/action.context';
import { APP_CODE_PREFIX_CAPS_API_NOTIFICATION_SUMMARY_ID_FOR_UID } from 'FIREBASE_COMPONENTS_NAME';

export function APP_CODE_PREFIXNotificationSendServiceFactory(APP_CODE_PREFIX_CAMELFirebaseServerActionsContext: APP_CODE_PREFIXFirebaseServerActionsContext): NotificationSendService {
  const { mailgunService } = APP_CODE_PREFIX_CAMELFirebaseServerActionsContext;

  const emailSendService = APP_CODE_PREFIXNotificationMailgunSendService(mailgunService);
  const notificationSummarySendService = firestoreNotificationSummarySendService({
    context: APP_CODE_PREFIX_CAMELFirebaseServerActionsContext
  });

  const notificationSendService: NotificationSendService = {
    emailSendService,
    textSendService: ignoreSendNotificationTextSendService(),
    notificationSummarySendService,
    notificationSummaryIdForUidFunction: APP_CODE_PREFIX_CAPS_API_NOTIFICATION_SUMMARY_ID_FOR_UID
  };

  return notificationSendService;
}
