import { exampleUsageOfSchedule, hourlySchedule } from '../example/example.schedule';
import { onScheduleWithDemoNestContext } from '../function';
import { notificationHourlyUpdateSchedule } from '../notification/notification.schedule';
import { storageFileHourlyUpdateSchedule } from '../storagefile/storagefile.schedule';

// MARK: Example
export const demoExampleUsageOfSchedule = onScheduleWithDemoNestContext(
  {
    cron: 60, // Once every hour on the hour
    timeoutSeconds: 30 // execute for 30 seconds max
  },
  async (x) => {
    await exampleUsageOfSchedule(x);
    await hourlySchedule(x);
    await storageFileHourlyUpdateSchedule(x);
    await notificationHourlyUpdateSchedule(x);
  }
);
