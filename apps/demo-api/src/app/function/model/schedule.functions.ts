import { calendarHourlyUpdateSchedule } from '../calendar/calendar.schedule';
import { exampleUsageOfSchedule, hourlySchedule } from '../example/example.schedule';
import { onScheduleWithDemoNestContext } from '../function.context';
import { notificationHourlyUpdateSchedule } from '../notification/notification.schedule';
import { storageFileHourlyUpdateSchedule } from '../storagefile/storagefile.schedule';
import { openRouterRunTaskExpirationSweepSchedule, openRouterRunTaskSweepSchedule } from '../openrouter/openrouter.schedule';

// MARK: Example
export const demoExampleUsageOfSchedule = onScheduleWithDemoNestContext(
  {
    cron: 60, // Once every hour on the hour
    timeoutSeconds: 30 // execute for 30 seconds max
  },
  async (x) => {
    await exampleUsageOfSchedule(x);
    await hourlySchedule(x);
    await calendarHourlyUpdateSchedule(x); // queues the ICS StorageFile that the storagefile sweep then processes
    await storageFileHourlyUpdateSchedule(x);
    await notificationHourlyUpdateSchedule(x);
    await openRouterRunTaskSweepSchedule(x);
    await openRouterRunTaskExpirationSweepSchedule(x);
  }
);
