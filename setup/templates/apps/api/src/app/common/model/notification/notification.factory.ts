import { EXAMPLE_NOTIFICATION_TEMPLATE_TYPE, ExampleNotificationData, TEST_NOTIFICATIONS_TEMPLATE_TYPE } from 'FIREBASE_COMPONENTS_NAME';
import { NotificationMessageFunctionFactoryConfig, NotificationMessageInputContext, NotificationMessageContent, NotificationMessage, firestoreModelId, NotificationMessageFlag } from '@dereekb/firebase';
import { APP_CODE_PREFIXFirebaseServerActionsContext } from '../../firebase/action.context';
import { NotificationTemplateServiceTypeConfig } from '@dereekb/firebase-server/model';

// MARK: Test
export function APP_CODE_PREFIXNotificationTestFactory(context: APP_CODE_PREFIXFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
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
export function APP_CODE_PREFIXExampleNotificationFactory(context: APP_CODE_PREFIXFirebaseServerActionsContext): NotificationTemplateServiceTypeConfig {
  return {
    type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<ExampleNotificationData>) => {
      const { item } = config;
      const { d } = item;

      return async (inputContext: NotificationMessageInputContext) => {
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
      };
    }
  };
}

// MARK: All
export const APP_CODE_PREFIXNotificationTemplateServiceConfigsArrayFactory = (context: APP_CODE_PREFIXFirebaseServerActionsContext) => {
  return [APP_CODE_PREFIXNotificationTestFactory(context), APP_CODE_PREFIXExampleNotificationFactory(context)];
};
