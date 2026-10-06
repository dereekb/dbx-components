import { type NotificationSendService, firestoreNotificationSummarySendService, ignoreSendNotificationTextSendService } from '@dereekb/firebase-server/model';
import { twilioNotificationTextSendService } from '@dereekb/firebase-server/twilio';
import { type TwilioService } from '@dereekb/nestjs/twilio';
import { type Maybe } from '@dereekb/util';
import { demoNotificationMailgunSendService } from './notification.send.mailgun.service';
import { type DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { DEMO_API_NOTIFICATION_SUMMARY_ID_FOR_UID } from 'demo-firebase';

/**
 * Assembles the composite NotificationSendService for the demo API,
 * wiring together Mailgun email delivery, Twilio text delivery (or a no-op
 * text service when Twilio is not configured), and Firestore-backed
 * notification summary persistence.
 *
 * @param demoFirebaseServerActionsContext - Server actions context providing the Mailgun service and Firestore access.
 * @param twilioService - Twilio service used to send texts. When unset, texts are ignored.
 * @returns A fully configured NotificationSendService for the demo app.
 */
export function demoNotificationSendServiceFactory(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext, twilioService?: Maybe<TwilioService>): NotificationSendService {
  const { mailgunService } = demoFirebaseServerActionsContext;

  const emailSendService = demoNotificationMailgunSendService(mailgunService);
  const textSendService = twilioService ? twilioNotificationTextSendService({ twilioService }) : ignoreSendNotificationTextSendService();
  const notificationSummarySendService = firestoreNotificationSummarySendService({
    context: demoFirebaseServerActionsContext
  });

  const notificationSendService: NotificationSendService = {
    emailSendService,
    textSendService,
    notificationSummarySendService,
    notificationSummaryIdForUidFunction: DEMO_API_NOTIFICATION_SUMMARY_ID_FOR_UID
  };

  return notificationSendService;
}
