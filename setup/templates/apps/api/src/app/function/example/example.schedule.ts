import { APP_CODE_PREFIXScheduleFunction } from '../function';

export const exampleUsageOfSchedule: APP_CODE_PREFIXScheduleFunction = (request) => {
  console.log('exampleUsageOfSchedule() was called!');
};

export const hourlySchedule: APP_CODE_PREFIXScheduleFunction = async (request) => {
  const { nest } = request;

  console.log('Initializing notification boxes and summaries...');
  await nest.notificationInitActions.initializeAllApplicableNotificationBoxes({}).then((x) => x());
  await nest.notificationInitActions.initializeAllApplicableNotificationSummaries({}).then((x) => x());

  console.log('Sending queued notifications...');
  const sendQueuedNotificationsResult = await nest.notificationActions.sendQueuedNotifications({}).then((x) => x());
  console.log({ sendQueuedNotificationsResult });
};
