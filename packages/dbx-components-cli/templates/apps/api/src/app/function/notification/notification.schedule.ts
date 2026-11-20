import { type APP_CODE_PREFIXScheduleFunction } from '../function';

export const notificationUpdateSchedule: APP_CODE_PREFIXScheduleFunction = async (request) => {
  // init all new notification boxes
  const initializeAllApplicableNotificationBoxes = await request.nest.notificationInitActions.initializeAllApplicableNotificationBoxes({});
  const initializeNotificationBoxesResult = await initializeAllApplicableNotificationBoxes();

  console.log({ initializeNotificationBoxesResult });

  // send all queued notifications
  const sendQueuedNotifications = await request.nest.notificationActions.sendQueuedNotifications({});
  const sendQueuedNotificationsResult = await sendQueuedNotifications();

  console.log({ sendQueuedNotificationsResult });

  // delete sent notifications past their retention window, and every expired NotificationRedirectEntry (short link)
  const cleanupSentNotifications = await request.nest.notificationActions.cleanupSentNotifications({});
  const cleanupSentNotificationsResult = await cleanupSentNotifications();

  console.log({ cleanupSentNotificationsResult });
};
