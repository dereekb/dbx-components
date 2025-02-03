import { TEST_NOTIFICATIONS_TEMPLATE_TYPE } from '@dereekb/demo-firebase'; // TODO: rename to demo-firebase
import { NotificationMessageFunctionFactoryConfig, NotificationMessageInputContext, NotificationMessageContent, NotificationMessage } from '@dereekb/firebase';
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

// MARK: All
export const demoNotificationTemplateServiceConfigsArrayFactory = (context: DemoFirebaseServerActionsContext) => {
  return [demoNotificationTestFactory(context)];
};
