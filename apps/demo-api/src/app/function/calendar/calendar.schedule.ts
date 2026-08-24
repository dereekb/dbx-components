import { type DemoScheduleFunction, runDemoScheduledTasks } from '../function.context';

export const calendarHourlyUpdateSchedule: DemoScheduleFunction = async (request) => {
  console.log('calendarHourlyUpdateSchedule - running');

  await runDemoScheduledTasks({
    // the backstop runs FIRST so a calendar it re-flags is swept in this same tick rather than the next
    flagStaleCalendarsForSync: async () => {
      const flagStaleCalendarsForSync = await request.nest.calendarServerActions.flagStaleCalendarsForSync({});
      const flagStaleCalendarsForSyncResult = await flagStaleCalendarsForSync();
      return { flagStaleCalendarsForSyncResult };
    },
    syncAllFlaggedCalendars: async () => {
      const syncAllFlaggedCalendars = await request.nest.calendarServerActions.syncAllFlaggedCalendars({});
      const syncAllFlaggedCalendarsResult = await syncAllFlaggedCalendars();
      return { syncAllFlaggedCalendarsResult };
    }
  });

  console.log('calendarHourlyUpdateSchedule - done');
};
