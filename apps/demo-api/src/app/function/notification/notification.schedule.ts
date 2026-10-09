import { type DemoScheduleFunction, runDemoScheduledTasks } from '../function.context';

export const notificationHourlyUpdateSchedule: DemoScheduleFunction = async (request) => {
  console.log('notificationHourlyUpdateSchedule - running');

  await runDemoScheduledTasks({
    initializeAllApplicableNotificationBoxes: async () => {
      const initializeAllApplicableNotificationBoxes = await request.nest.notificationInitActions.initializeAllApplicableNotificationBoxes({});
      const initializeNotificationBoxesResult = await initializeAllApplicableNotificationBoxes();
      return { initializeNotificationBoxesResult };
    },
    initializeAllApplicableNotificationSummaries: async () => {
      const initializeAllApplicableNotificationSummaries = await request.nest.notificationInitActions.initializeAllApplicableNotificationSummaries({});
      const initializeNotificationSummariesResult = await initializeAllApplicableNotificationSummaries();
      return { initializeNotificationSummariesResult };
    },
    // sync the NotificationUser box configs that are still flagged before sending, so sends read synced boxes
    resyncAllNotificationUsers: async () => {
      const resyncAllNotificationUsersResult = await request.nest.notificationActions.resyncAllNotificationUsers();
      return { resyncAllNotificationUsersResult };
    },
    sendQueuedNotifications: async () => {
      const sendQueuedNotifications = await request.nest.notificationActions.sendQueuedNotifications({});
      const sendQueuedNotificationsResult = await sendQueuedNotifications();
      return { sendQueuedNotificationsResult };
    },
    // repair NotificationTaskBot entries whose run went missing, after the queue had its chance to run them
    repairAllNotificationTaskBots: async () => {
      const repairAllNotificationTaskBotsResult = await request.nest.notificationActions.repairAllNotificationTaskBots();
      return { repairAllNotificationTaskBotsResult };
    }
  });

  console.log('notificationHourlyUpdateSchedule - done');
};
