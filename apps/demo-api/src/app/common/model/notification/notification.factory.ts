import {
  CALENDAR_EVENT_INVITE_NOTIFICATION_TEMPLATE_TYPE,
  type CalendarEventInviteNotificationData,
  EXAMPLE_NOTIFICATION_TEMPLATE_ON_SEND_ATTEMPTED_RESULT,
  EXAMPLE_NOTIFICATION_TEMPLATE_ON_SEND_SUCCESS_RESULT,
  EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
  type ExampleNotificationData,
  GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE,
  GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE,
  TEST_NOTIFICATIONS_TEMPLATE_TYPE
} from 'demo-firebase'; // TODO: rename to demo-firebase
import {
  type NotificationMessageFunctionFactoryConfig,
  type NotificationMessageInputContext,
  type NotificationMessageContent,
  type NotificationMessageEmailContent,
  type NotificationMessage,
  type NotificationMessageCalendarAttachmentFactory,
  type NotificationMessageCalendarAttachmentMethod,
  calendarEventItemForId,
  calendarEventItemToInviteIcsString,
  firestoreModelId,
  firestoreModelKeyParentKey,
  NotificationMessageFlag,
  notificationMessageFunction
} from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { type NotificationTemplateServiceTypeConfig } from '@dereekb/firebase-server/model';
import { DEMO_CALENDAR_ICS_DOMAIN, DEMO_CALENDAR_INVITE_ORGANIZER } from '../calendar/calendar.module';

// MARK: Text
/**
 * Prefix for every demo notification text, so the recipient knows which app sent it.
 */
export const DEMO_NOTIFICATION_TEXT_PREFIX = 'dbx-components: ';

/**
 * Creates the text content for a demo notification.
 *
 * Texts are a single short GSM-7 line followed by a deep link, which keeps each one within a single SMS
 * segment or two. The Twilio sender joins the title and action url with a newline.
 *
 * @param message - Short GSM-7 message, without the {@link DEMO_NOTIFICATION_TEXT_PREFIX}.
 * @param actionUrl - Deep link into the demo app.
 * @returns The text content.
 */
export function demoNotificationTextContent(message: string, actionUrl: string): NotificationMessageContent {
  return {
    title: `${DEMO_NOTIFICATION_TEXT_PREFIX}${message}`,
    actionUrl
  };
}

// MARK: Test
/**
 * Creates a notification template config for test notifications with static content.
 * Used in integration tests to verify the notification pipeline.
 *
 * @param context - Server actions context used to resolve the client URL for the text deep link.
 * @returns A notification template service config for the test notification type.
 */
export function demoNotificationTestFactory(context: DemoFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
  return {
    type: TEST_NOTIFICATIONS_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<{}>) => {
      const { item } = config;
      const textContent = demoNotificationTextContent('This is a test notification.', `${context.mailgunService.mailgunApi.clientUrl}/demo/app/notification`);

      return notificationMessageFunction(async (inputContext: NotificationMessageInputContext) => {
        const content: NotificationMessageContent = {
          title: 'This is a test notification',
          action: 'View test',
          actionUrl: ``
        };

        const result: NotificationMessage = {
          inputContext,
          item,
          content,
          textContent
        };

        return result;
      });
    }
  };
}
/**
 * Creates a notification template config for example notifications.
 * Supports optional send skipping via the notification data's skipSend flag,
 * and includes onSendAttempted/onSendSuccess lifecycle hooks.
 *
 * @param context - Server actions context used to resolve the client URL for the text deep link.
 * @returns A notification template service config for the example notification type.
 */
export function demoExampleNotificationFactory(context: DemoFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
  return {
    type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<ExampleNotificationData>) => {
      const { item } = config;
      const { d } = item;
      const textContent = demoNotificationTextContent('This is an example notification. Open the app to view your notifications.', `${context.mailgunService.mailgunApi.clientUrl}/demo/app/notification`);

      return notificationMessageFunction(
        async (inputContext: NotificationMessageInputContext) => {
          const content: NotificationMessageContent = {
            title: 'This is a test notification',
            openingMessage: `This is a test notification intended for user with uid "${item.d?.uid}". This is a test message and contains the opening text of a notification.`,
            closingMessage: `This is the closing part of the message.`,
            action: 'View test',
            actionUrl: ``
          };

          const result: NotificationMessage = {
            inputContext,
            item,
            content,
            textContent,
            flag: d?.skipSend ? NotificationMessageFlag.DO_NOT_SEND : undefined
          };

          return result;
        },
        {
          onSendAttempted: async () => {
            return EXAMPLE_NOTIFICATION_TEMPLATE_ON_SEND_ATTEMPTED_RESULT;
          },
          onSendSuccess: async () => {
            return EXAMPLE_NOTIFICATION_TEMPLATE_ON_SEND_SUCCESS_RESULT;
          }
        }
      );
    }
  };
}

/**
 * Creates a notification template config for guestbook entry creation events.
 * Builds a notification message linking to the guestbook the entry was created in.
 *
 * @param context - Server actions context used to resolve the client URL for action links.
 * @returns A notification template service config for the guestbook entry created type.
 */
export function demoGuestbookEntryCreatedNotificationFactory(context: DemoFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
  return {
    type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<{}>) => {
      const { item } = config;
      // the target model is the guestbook the entry was created in
      const guestbookId = firestoreModelId(item.m as string);
      const actionUrl = `${context.mailgunService.mailgunApi.clientUrl}/demo/app/guestbook/${guestbookId}`;
      const textContent = demoNotificationTextContent('A new guestbook entry was created.', actionUrl);

      return notificationMessageFunction(async (inputContext: NotificationMessageInputContext) => {
        const content: NotificationMessageContent = {
          title: 'A new guestbook entry has been created',
          action: 'View entry',
          actionUrl
        };

        const result: NotificationMessage = {
          inputContext,
          item,
          content,
          textContent
        };

        return result;
      });
    }
  };
}

/**
 * Creates a notification template config for guestbook entry like events.
 * Builds a notification message linking to the guestbook of the liked entry.
 *
 * @param context - Server actions context used to resolve the client URL for action links.
 * @returns A notification template service config for the guestbook entry liked type.
 */
export function demoGuestbookEntryLikedNotificationFactory(context: DemoFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
  return {
    type: GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<{}>) => {
      const { item } = config;
      // the target model is the liked guestbook entry, whose id is its creator's uid, so link to its parent guestbook
      const guestbookId = firestoreModelId(firestoreModelKeyParentKey(item.m as string) as string);
      const actionUrl = `${context.mailgunService.mailgunApi.clientUrl}/demo/app/guestbook/${guestbookId}`;
      const textContent = demoNotificationTextContent('Your guestbook entry has a new like.', actionUrl);

      return notificationMessageFunction(async (inputContext: NotificationMessageInputContext) => {
        const content: NotificationMessageContent = {
          title: 'Your guestbook entry has a new like.',
          action: 'View entry',
          actionUrl
        };

        const result: NotificationMessage = {
          inputContext,
          item,
          content,
          textContent
        };

        return result;
      });
    }
  };
}

/**
 * Creates a notification template config for calendar event invites.
 *
 * Renders a per-recipient iTIP payload at SEND time rather than storing one on the notification: the item's
 * `d` is re-embedded into the 1 MiB notification summary/week documents, and -- more fundamentally -- a
 * `METHOD:REQUEST` is only rendered inline by a client that finds its OWN address in the ATTENDEE, so there
 * is no single payload to store.
 *
 * The UID comes from the same `domain` + calendar id the published feed uses, which is what stops a
 * recipient who is both subscribed to the feed and holding the invite from seeing the event twice.
 *
 * @param context - Server actions context used to load the target calendar.
 * @returns A notification template service config for the calendar event invite type.
 */
export function demoCalendarEventInviteNotificationFactory(context: DemoFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
  const { calendarCollection } = context;

  return {
    type: CALENDAR_EVENT_INVITE_NOTIFICATION_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<CalendarEventInviteNotificationData>) => {
      const { item } = config;
      const { eventId, cancel } = item.d ?? {};

      // read ONCE per notification, outside the per-recipient function: only the ATTENDEE varies per recipient
      const calendarId = firestoreModelId(item.m as string);
      const calendar = await calendarCollection.documentAccessor().loadDocumentForId(calendarId).snapshotData();
      const event = calendar && eventId ? calendarEventItemForId(calendar, eventId) : undefined;
      const method: NotificationMessageCalendarAttachmentMethod = cancel ? 'CANCEL' : 'REQUEST';
      // no textContent: the type only lists email in its userConfigurableDeliveryMethods, since the invite is the email's calendar part
      const actionUrl = `${context.mailgunService.mailgunApi.clientUrl}/demo/app/calendar`;

      // ONE factory per notification, closing over the loaded event. The sending service calls it with the
      // address it resolved for each recipient, so the ICS is rendered only for the recipients actually
      // receiving an email -- and each one names ITS OWN address as the ATTENDEE, which is what makes a
      // client render the invite inline.
      const calendarAttachmentFactory: Maybe<NotificationMessageCalendarAttachmentFactory> = event
        ? ({ recipient }) => ({
            method,
            filename: cancel ? 'cancel.ics' : 'invite.ics',
            ics: calendarEventItemToInviteIcsString({
              item: event,
              calendarId,
              method,
              domain: DEMO_CALENDAR_ICS_DOMAIN,
              organizer: DEMO_CALENDAR_INVITE_ORGANIZER,
              attendees: { address: recipient.email, name: recipient.name },
              timezone: calendar?.tz,
              // the CONTENT's instant, so DTSTAMP moves only when the event moves
              now: event.uat
            })
          })
        : undefined;

      return notificationMessageFunction(async (inputContext: NotificationMessageInputContext) => {
        const content: NotificationMessageContent = {
          title: cancel ? `An event was removed from your calendar` : `You were added to a calendar event`,
          openingMessage: event?.n ?? '',
          action: 'View calendar',
          actionUrl
        };

        // without an event there is nothing to describe, so the message carries no calendar part -- it is
        // flagged NO_CONTENT below rather than sent as a bare email.
        const emailContent: NotificationMessageEmailContent | undefined = calendarAttachmentFactory ? { ...content, calendarAttachmentFactory } : undefined;

        const result: NotificationMessage = {
          inputContext,
          item,
          content,
          emailContent,
          flag: event ? undefined : NotificationMessageFlag.NO_CONTENT
        };

        return result;
      });
    }
  };
}

// MARK: All
export const demoNotificationTemplateServiceConfigsArrayFactory = (context: DemoFirebaseServerActionsContext) => {
  return [demoNotificationTestFactory(context), demoExampleNotificationFactory(context), demoGuestbookEntryCreatedNotificationFactory(context), demoGuestbookEntryLikedNotificationFactory(context), demoCalendarEventInviteNotificationFactory(context)];
};
