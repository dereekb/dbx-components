import { type FirebaseServerAnalyticsService } from '@dereekb/firebase-server';
import { notificationUserTwilioTextKeywordHandler, type NotificationUserTwilioTextKeywordHandlerContext, type TwilioTextKeywordHandler } from '@dereekb/firebase-server/twilio';

/**
 * Analytics event name sent for each NotificationUser that texts STOP, START or HELP.
 */
export const DEMO_TEXT_KEYWORD_ANALYTICS_EVENT_NAME = 'Text Keyword';

/**
 * Config for {@link demoTwilioTextKeywordAnalyticsHandler}.
 */
export interface DemoTwilioTextKeywordAnalyticsHandlerConfig {
  /**
   * Provides the NotificationUser collection.
   */
  readonly context: NotificationUserTwilioTextKeywordHandlerContext;
  /**
   * Receives the analytics events.
   */
  readonly analyticsService: Pick<FirebaseServerAnalyticsService, 'sendEventData'>;
}

/**
 * Creates the Demo app's `onTextKeyword` handler, which sends a {@link DEMO_TEXT_KEYWORD_ANALYTICS_EVENT_NAME} analytics event for
 * each NotificationUser that texted STOP, START or HELP.
 *
 * The event is keyed by the user's uid and carries only the keyword, never the phone number.
 *
 * @param config - The NotificationUser collection context and the analytics service.
 * @returns The keyword handler to pass to `twilioNotificationTextOptOutHandler()`.
 */
export function demoTwilioTextKeywordAnalyticsHandler(config: DemoTwilioTextKeywordAnalyticsHandlerConfig): TwilioTextKeywordHandler {
  const { context, analyticsService } = config;

  return notificationUserTwilioTextKeywordHandler({
    context,
    onNotificationUserLoaded: ({ event, uid }) => analyticsService.sendEventData(uid, DEMO_TEXT_KEYWORD_ANALYTICS_EVENT_NAME, { keyword: event.type })
  });
}
