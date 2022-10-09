import { exampleUsageOfSchedule } from '../example/example.schedule';
import { onScheduleWithAPP_CODE_PREFIXNestContext } from '../function';

// MARK: Example
export const APP_CODE_PREFIX_LOWERExampleUsageOfSchedule = onScheduleWithAPP_CODE_PREFIXNestContext(
  {
    cron: 60 // Once every hour on the hour
  },
  exampleUsageOfSchedule
);
