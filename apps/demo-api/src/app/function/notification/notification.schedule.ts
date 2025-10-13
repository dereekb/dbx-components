import { DemoScheduleFunction } from '../function';

export const notificationHourlyUpdateSchedule: DemoScheduleFunction = async (request) => {
  // init all new notification boxes
  const initializeAllApplicableNotificationBoxes = await request.nest.notificationInitActions.initializeAllApplicableNotificationBoxes({});
  const initializeNotificationBoxesResult = await initializeAllApplicableNotificationBoxes();

  console.log({ initializeNotificationBoxesResult });

  // init all new notification summaries
  const initializeAllApplicableNotificationSummaries = await request.nest.notificationInitActions.initializeAllApplicableNotificationSummaries({});
  const initializeNotificationSummariesResult = await initializeAllApplicableNotificationSummaries();

  console.log({ initializeNotificationSummariesResult });

  // send all queued notifications
  const sendQueuedNotifications = await request.nest.notificationActions.sendQueuedNotifications({});
  const sendQueuedNotificationsResult = await sendQueuedNotifications();

  console.log({ sendQueuedNotificationsResult });
};
