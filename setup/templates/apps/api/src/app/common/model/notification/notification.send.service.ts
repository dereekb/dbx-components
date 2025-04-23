import { NotificationSendService, firestoreNotificationSummarySendService, ignoreSendNotificationTextSendService } from '@dereekb/firebase-server/model';
import { APP_CODE_PREFIX_LOWERNotificationMailgunSendService } from './notification.send.mailgun.service';
import { APP_CODE_PREFIXFirebaseServerActionsContext } from '../../firebase/action.context';
import { APP_CODE_PREFIX_UPPER_API_NOTIFICATION_SUMMARY_ID_FOR_UID } from '@dereekb/APP_CODE_PREFIX-firebase';

export function APP_CODE_PREFIX_LOWERNotificationSendServiceFactory(APP_CODE_PREFIX_LOWERFirebaseServerActionsContext: APP_CODE_PREFIXFirebaseServerActionsContext): NotificationSendService {
  const { mailgunService } = APP_CODE_PREFIX_LOWERFirebaseServerActionsContext;

  const emailSendService = APP_CODE_PREFIX_LOWERNotificationMailgunSendService(mailgunService);
  const notificationSummarySendService = firestoreNotificationSummarySendService({
    context: APP_CODE_PREFIX_LOWERFirebaseServerActionsContext
  });

  const notificationSendService: NotificationSendService = {
    emailSendService,
    textSendService: ignoreSendNotificationTextSendService(),
    notificationSummarySendService,
    notificationSummaryIdForUidFunction: APP_CODE_PREFIX_UPPER_API_NOTIFICATION_SUMMARY_ID_FOR_UID
  };

  return notificationSendService;
}
