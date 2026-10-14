// AUTO-GENERATED — DO NOT EDIT.
// Run `npx nx run demo-cli:generate-notification-manifest` to refresh.

import { type CliGeneratedManifestStamp, type CliNotificationManifest } from '@dereekb/dbx-cli';

export const DEMO_CLI_NOTIFICATION_MANIFEST_STAMP: CliGeneratedManifestStamp = { generatorVersion: '14.16.0' };

export const DEMO_CLI_NOTIFICATION_MANIFEST: CliNotificationManifest = {
  tasks: [
    {
      type: 'E',
      symbolName: 'EXAMPLE_NOTIFICATION_TASK_TYPE',
      dataInterfaceName: 'ExampleNotificationTaskData',
      checkpoints: ['part_a', 'part_b', 'part_c'],
      hasHandler: true,
      handlerFlowStepCount: 3,
      sourceFile: 'src/lib/model/notification/notification.task.ts'
    },
    {
      type: 'EH',
      symbolName: 'EXAMPLE_HANDLED_NOTIFICATION_TASK_TYPE',
      dataInterfaceName: 'ExampleHandledNotificationTaskData',
      checkpoints: [],
      hasHandler: true,
      handlerFlowStepCount: 1,
      sourceFile: 'src/lib/model/notification/notification.task.ts'
    },
    {
      type: 'EU',
      symbolName: 'EXAMPLE_UNIQUE_NOTIFICATION_TASK_TYPE',
      dataInterfaceName: 'ExampleUniqueNotificationTaskData',
      checkpoints: ['part_a', 'part_b'],
      hasHandler: true,
      handlerFlowStepCount: 2,
      sourceFile: 'src/lib/model/notification/notification.task.ts'
    }
  ],
  templates: [
    {
      type: 'CAL_INV',
      symbolName: 'CALENDAR_EVENT_INVITE_NOTIFICATION_TEMPLATE_TYPE',
      factoryFunctionName: 'demoCalendarEventInviteNotificationFactory',
      factoryContentDeliveryMethods: ['e'],
      forcedDeliveryMethods: ['e'],
      sourceFile: 'src/lib/model/notification/notification.ts'
    },
    {
      type: 'E',
      symbolName: 'EXAMPLE_NOTIFICATION_TEMPLATE_TYPE',
      factoryFunctionName: 'demoExampleNotificationFactory',
      factoryContentDeliveryMethods: ['t'],
      sourceFile: 'src/lib/model/notification/notification.ts'
    },
    {
      type: 'GBE_C',
      symbolName: 'GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE',
      factoryFunctionName: 'demoGuestbookEntryCreatedNotificationFactory',
      factoryContentDeliveryMethods: ['t'],
      sourceFile: 'src/lib/model/notification/notification.ts'
    },
    {
      type: 'GBE_L',
      symbolName: 'GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE',
      factoryFunctionName: 'demoGuestbookEntryLikedNotificationFactory',
      factoryContentDeliveryMethods: ['t'],
      sourceFile: 'src/lib/model/notification/notification.ts'
    },
    {
      type: 'TEST',
      symbolName: 'TEST_NOTIFICATIONS_TEMPLATE_TYPE',
      factoryFunctionName: 'demoNotificationTestFactory',
      factoryContentDeliveryMethods: ['t'],
      sourceFile: 'src/lib/model/notification/notification.ts'
    }
  ]
};
