import { EXAMPLE_NOTIFICATION_TEMPLATE_ON_SEND_ATTEMPTED_RESULT, EXAMPLE_NOTIFICATION_TEMPLATE_ON_SEND_SUCCESS_RESULT, EXAMPLE_NOTIFICATION_TEMPLATE_TYPE, type ExampleNotificationData, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE, TEST_NOTIFICATIONS_TEMPLATE_TYPE } from 'demo-firebase'; // TODO: rename to demo-firebase
import { type NotificationMessageFunctionFactoryConfig, type NotificationMessageInputContext, type NotificationMessageContent, type NotificationMessage, firestoreModelId, NotificationMessageFlag, notificationMessageFunction } from '@dereekb/firebase';
import { type DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { type NotificationTemplateServiceTypeConfig } from '@dereekb/firebase-server/model';

// MARK: Test
/**
 * Creates a notification template config for test notifications with static content.
 * Used in integration tests to verify the notification pipeline.
 *
 * @param _context - server actions context (unused but kept for factory signature consistency)
 * @returns a notification template service config for the test notification type
 */
export function demoNotificationTestFactory(_context: DemoFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
  return {
    type: TEST_NOTIFICATIONS_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<{}>) => {
      const { item } = config;
      return notificationMessageFunction(async (inputContext: NotificationMessageInputContext) => {
        const content: NotificationMessageContent = {
          title: 'This is a test notification',
          action: 'View test',
          actionUrl: ``
        };

        const result: NotificationMessage = {
          inputContext,
          item,
          content
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
 * @param _context - server actions context (unused but kept for factory signature consistency)
 * @returns a notification template service config for the example notification type
 */
export function demoExampleNotificationFactory(_context: DemoFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
  return {
    type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<ExampleNotificationData>) => {
      const { item } = config;
      const { d } = item;

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
 * Builds a notification message linking to the newly created guestbook entry.
 *
 * @param context - server actions context used to resolve the client URL for action links
 * @returns a notification template service config for the guestbook entry created type
 */
export function demoGuestbookEntryCreatedNotificationFactory(context: DemoFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
  return {
    type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<{}>) => {
      const { item } = config;
      return notificationMessageFunction(async (inputContext: NotificationMessageInputContext) => {
        const entryId = firestoreModelId(item.m as string);
        const actionUrl = context.mailgunService.mailgunApi.clientUrl + `/guestbook/${entryId}`;

        const content: NotificationMessageContent = {
          title: 'A new guestbook entry has been created',
          action: 'View entry',
          actionUrl
        };

        const result: NotificationMessage = {
          inputContext,
          item,
          content
        };

        return result;
      });
    }
  };
}

/**
 * Creates a notification template config for guestbook entry like events.
 * Builds a notification message linking to the liked guestbook entry.
 *
 * @param context - server actions context used to resolve the client URL for action links
 * @returns a notification template service config for the guestbook entry liked type
 */
export function demoGuestbookEntryLikedNotificationFactory(context: DemoFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
  return {
    type: GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<{}>) => {
      const { item } = config;
      return notificationMessageFunction(async (inputContext: NotificationMessageInputContext) => {
        const entryId = firestoreModelId(item.m as string);
        const actionUrl = context.mailgunService.mailgunApi.clientUrl + `/guestbook/${entryId}`;

        const content: NotificationMessageContent = {
          title: 'Your guestbook entry has a new like.',
          action: 'View entry',
          actionUrl
        };

        const result: NotificationMessage = {
          inputContext,
          item,
          content
        };

        return result;
      });
    }
  };
}

// MARK: All
export const demoNotificationTemplateServiceConfigsArrayFactory = (context: DemoFirebaseServerActionsContext) => {
  return [demoNotificationTestFactory(context), demoExampleNotificationFactory(context), demoGuestbookEntryCreatedNotificationFactory(context), demoGuestbookEntryLikedNotificationFactory(context)];
};
