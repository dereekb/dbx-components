import { type TwilioNotificationHealthCheckProbeBuilderInput, type TwilioNotificationTextSendService, twilioNotificationTextSendService, twilioNotificationTextSendServiceHealthCheckService } from '@dereekb/firebase-server/twilio';
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
 * Creates the Twilio {@link TwilioNotificationTextSendService} for the Demo app.
 *
 * @param twilioService - The Twilio service the texts are sent through.
 * @returns The send service, with the delivery health check attached.
 */
export function demoNotificationTwilioSendService(twilioService: TwilioService): TwilioNotificationTextSendService {
  return twilioNotificationTextSendService({
    twilioService,
    healthCheckService: twilioNotificationTextSendServiceHealthCheckService({
      twilioService,
      probeBuilder: demoNotificationHealthCheckProbeText
    })
  });
}
