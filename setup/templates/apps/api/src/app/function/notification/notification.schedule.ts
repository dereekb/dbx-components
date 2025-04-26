import { APP_CODE_PREFIXScheduleFunction } from '../function';

export const notificationUpdateSchedule: APP_CODE_PREFIXScheduleFunction = async (request) => {
  // init all new notification boxes
  const initializeAllApplicableNotificationBoxes = await request.nest.notificationInitActions.initializeAllApplicableNotificationBoxes({});
  const initializeNotificationBoxesResult = await initializeAllApplicableNotificationBoxes();

  console.log({ initializeNotificationBoxesResult });

  // send all queued notifications
  const sendQueuedNotifications = await request.nest.notificationActions.sendQueuedNotifications({});
  const sendQueuedNotificationsResult = await sendQueuedNotifications();

  console.log({ sendQueuedNotificationsResult });
};
  