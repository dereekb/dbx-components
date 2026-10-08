import { type Provider } from '@nestjs/common';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { twilioWebhookUrls, type TwilioWebhookUrls, TwilioWebhookUrlsConfig } from '@dereekb/nestjs/twilio';
import { isStandardInternetAccessibleWebsiteUrl, type Maybe } from '@dereekb/util';

/**
 * Builds the app's Twilio webhook URLs from {@link FirebaseServerEnvService.appWebhookUrl}.
 *
 * Returns undefined when webhooks are disabled, or when the webhook URL is not reachable from the
 * internet (e.g. `localhost` during local development), since Twilio could not call it.
 *
 * @param envService - Supplies the app's public webhook URL.
 * @returns The Twilio webhook URLs, or undefined if Twilio cannot reach the app's webhooks.
 */
export function twilioWebhookUrlsForEnvService(envService: Pick<FirebaseServerEnvService, 'appWebhookUrl'>): Maybe<TwilioWebhookUrls> {
  const { appWebhookUrl } = envService;
  return appWebhookUrl && isStandardInternetAccessibleWebsiteUrl(appWebhookUrl) ? twilioWebhookUrls(appWebhookUrl) : undefined;
}

/**
 * Creates the NestJS provider for the app's {@link TwilioWebhookUrlsConfig}, built from
 * {@link FirebaseServerEnvService} by {@link twilioWebhookUrlsForEnvService}.
 *
 * Provide it from the `dependencyModule` passed to `appTwilioModuleMetadata()` and `appTwilioWebhookModuleMetadata()`,
 * so outbound texts request status callbacks at the app's webhook URL and webhook requests are verified against it.
 * The deployment then needs no Twilio URL configuration.
 *
 * @returns The NestJS provider.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function twilioWebhookUrlsConfigProvider(): Provider {
  return {
    provide: TwilioWebhookUrlsConfig,
    inject: [FirebaseServerEnvService],
    useFactory: (envService: FirebaseServerEnvService): TwilioWebhookUrlsConfig => ({ twilioWebhookUrls: twilioWebhookUrlsForEnvService(envService) })
  };
}
