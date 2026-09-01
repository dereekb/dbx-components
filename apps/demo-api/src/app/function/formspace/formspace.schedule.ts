import { type DemoScheduleFunction, runDemoScheduledTasks } from '../function.context';

export const formSpaceHourlyUpdateSchedule: DemoScheduleFunction = async (request) => {
  console.log('formSpaceHourlyUpdateSchedule - running');

  await runDemoScheduledTasks({
    // the backstop runs FIRST so a space whose task creation was lost is queued before anything else
    processAllQueuedFormSpaces: async () => {
      const processAllQueuedFormSpaces = await request.nest.formSpaceServerActions.processAllQueuedFormSpaces({});
      const processAllQueuedFormSpacesResult = await processAllQueuedFormSpaces();
      return { processAllQueuedFormSpacesResult };
    },
    expireAllExpiredFormSpaces: async () => {
      const expireAllExpiredFormSpaces = await request.nest.formSpaceServerActions.expireAllExpiredFormSpaces({});
      const expireAllExpiredFormSpacesResult = await expireAllExpiredFormSpaces();
      return { expireAllExpiredFormSpacesResult };
    }
  });

  console.log('formSpaceHourlyUpdateSchedule - done');
};
