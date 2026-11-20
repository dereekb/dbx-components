import { type TwilioNotificationHealthCheckProbeBuilderInput, type TwilioNotificationTextOptInConfirmationBuilderInput, type TwilioNotificationTextSendService, twilioNotificationTextSendService, twilioNotificationTextSendServiceHealthCheckService } from '@dereekb/firebase-server/twilio';
import { type TwilioSendSmsInput, type TwilioService } from '@dereekb/nestjs/twilio';

/**
 * Builds the test text dispatched when a user runs a delivery health check with probing enabled.
 *
 * This arrives on a real phone because someone asked the system to check whether their texts work, so it
 * says exactly that, and names the sender, rather than looking like an ordinary notification.
 *
 * @param input - The probe recipient.
 * @returns The probe text request.
 */
export function demoNotificationHealthCheckProbeText(input: TwilioNotificationHealthCheckProbeBuilderInput): TwilioSendSmsInput {
  return {
    to: input.to,
    body: 'dbx-components demo: this is a test text confirming that we can text this number. No reply is needed.'
  };
}

/**
 * Builds the confirmation text sent when a user opts in to notification texts, or changes the number they are opted in with.
 *
 * Carriers expect it to name the brand, the message frequency, that message and data rates may apply, and how to get help or opt out.
 *
 * @param input - The confirmation recipient.
 * @returns The confirmation text request.
 */
export function demoNotificationTextOptInConfirmationText(input: TwilioNotificationTextOptInConfirmationBuilderInput): TwilioSendSmsInput {
  return {
    to: input.to,
    body: 'dbx-components demo: you are now subscribed to notification texts. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.'
  };
}

/**
 * Creates the Twilio {@link TwilioNotificationTextSendService} for the Demo app.
 *
 * @param twilioService - The Twilio service the texts are sent through.
 * @returns The send service, with the delivery health check and the opt-in confirmation text attached.
 */
export function demoNotificationTwilioSendService(twilioService: TwilioService): TwilioNotificationTextSendService {
  return twilioNotificationTextSendService({
    twilioService,
    healthCheckService: twilioNotificationTextSendServiceHealthCheckService({
      twilioService,
      probeBuilder: demoNotificationHealthCheckProbeText
    }),
    optInConfirmationBuilder: demoNotificationTextOptInConfirmationText
  });
}
