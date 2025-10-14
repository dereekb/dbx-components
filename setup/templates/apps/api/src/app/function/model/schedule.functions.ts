import { exampleUsageOfSchedule, hourlySchedule } from '../example/example.schedule';
import { onScheduleWithAPP_CODE_PREFIXNestContext } from '../function';
import { storageFileHourlyUpdateSchedule } from '../storagefile/storagefile.schedule';

// MARK: Example
export const APP_CODE_PREFIX_CAMELExampleUsageOfSchedule = onScheduleWithAPP_CODE_PREFIXNestContext(
  {
    cron: 60, // Once every hour on the hour
    timeoutSeconds: 30 // execute for 30 seconds max
  },
  async (x) => {
    await exampleUsageOfSchedule(x);
    await hourlySchedule(x);
    await storageFileHourlyUpdateSchedule(x)
  }
);
