import { type DemoScheduleFunction, runDemoScheduledTasks } from '../function';

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
    sendQueuedNotifications: async () => {
      const sendQueuedNotifications = await request.nest.notificationActions.sendQueuedNotifications({});
      const sendQueuedNotificationsResult = await sendQueuedNotifications();
      return { sendQueuedNotificationsResult };
    }
  });

  console.log('notificationHourlyUpdateSchedule - done');
};
