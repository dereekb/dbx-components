import { Logger } from '@nestjs/common';
import { type NotificationSendService, firestoreNotificationSummarySendService, ignoreSendNotificationTextSendService } from '@dereekb/firebase-server/model';
import { isTestNodeEnv } from '@dereekb/nestjs';
import { isUsableTwilioServiceConfig, type TwilioService } from '@dereekb/nestjs/twilio';
import { demoNotificationMailgunSendService } from './notification.send.mailgun.service';
import { demoNotificationTwilioSendService } from './notification.send.twilio.service';
import { type DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { DEMO_API_NOTIFICATION_SUMMARY_ID_FOR_UID } from 'demo-firebase';

/**
 * Assembles the composite NotificationSendService for the demo API,
 * wiring together Mailgun email delivery, Twilio text delivery (or a no-op
 * text service when Twilio is not configured), and Firestore-backed
 * notification summary persistence.
 *
 * Texts are ignored in the testing environment, so tests never send real SMS, and when the environment holds
 * no usable Twilio config, such as the placeholder values of the committed `.env`.
 *
 * @param demoFirebaseServerActionsContext - Server actions context providing the Mailgun service and Firestore access.
 * @param twilioService - Twilio service used to send texts.
 * @returns A fully configured NotificationSendService for the demo app.
 */
export function demoNotificationSendServiceFactory(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext, twilioService: TwilioService): NotificationSendService {
  const { mailgunService } = demoFirebaseServerActionsContext;
  const twilioConfig = twilioService.twilioApi.config;
  const sendTextsWithTwilio = !isTestNodeEnv() && isUsableTwilioServiceConfig(twilioConfig);

  if (sendTextsWithTwilio) {
    new Logger('DemoNotificationSendService').log(`Sending notification texts through Twilio${twilioConfig.messages.sandbox ? ' in sandbox mode' : ''}.`);
  }

  const emailSendService = demoNotificationMailgunSendService(mailgunService);
  const textSendService = sendTextsWithTwilio ? demoNotificationTwilioSendService(twilioService) : ignoreSendNotificationTextSendService();
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
