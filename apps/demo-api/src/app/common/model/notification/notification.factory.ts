import { EXAMPLE_NOTIFICATION_TEMPLATE_TYPE, ExampleNotificationData, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE, TEST_NOTIFICATIONS_TEMPLATE_TYPE } from '@dereekb/demo-firebase'; // TODO: rename to demo-firebase
import { NotificationMessageFunctionFactoryConfig, NotificationMessageInputContext, NotificationMessageContent, NotificationMessage, firestoreModelId } from '@dereekb/firebase';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { NotificationTemplateServiceTypeConfig } from '@dereekb/firebase-server/model';

// MARK: Test
export function demoNotificationTestFactory(context: DemoFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
  return {
    type: TEST_NOTIFICATIONS_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<{}>) => {
      const { item } = config;
      return async (inputContext: NotificationMessageInputContext) => {
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
      };
    }
  };
}
export function demoExampleNotificationFactory(context: DemoFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
  return {
    type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<ExampleNotificationData>) => {
      const { item } = config;

      return async (inputContext: NotificationMessageInputContext) => {
        const content: NotificationMessageContent = {
          title: 'This is a test notification',
          openingMessage: `This is a test notification inteded for user with uid "${item.d?.uid}". This is a test message and contains the opening text of a notification. The message is over the maximum length to show truncation of the message when saved to a NotificationSummary item.`,
          action: 'View test',
          actionUrl: ``
        };

        const result: NotificationMessage = {
          inputContext,
          item,
          content
        };

        return result;
      };
    }
  };
}

export function demoGuestbookEntryCreatedNotificationFactory(context: DemoFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
  return {
    type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<{}>) => {
      const { item } = config;
      return async (inputContext: NotificationMessageInputContext) => {
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
      };
    }
  };
}

export function demoGuestbookEntryLikedNotificationFactory(context: DemoFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
  return {
    type: GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<{}>) => {
      const { item } = config;
      return async (inputContext: NotificationMessageInputContext) => {
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
      };
    }
  };
}

// MARK: All
export const demoNotificationTemplateServiceConfigsArrayFactory = (context: DemoFirebaseServerActionsContext) => {
  return [demoNotificationTestFactory(context), demoExampleNotificationFactory(context), demoGuestbookEntryCreatedNotificationFactory(context), demoGuestbookEntryLikedNotificationFactory(context)];
};
