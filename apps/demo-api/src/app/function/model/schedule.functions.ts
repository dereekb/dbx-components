import { exampleUsageOfSchedule, hourlySchedule } from '../example/example.schedule';
import { onScheduleWithDemoNestContext } from '../function';

// MARK: Example
export const demoExampleUsageOfSchedule = onScheduleWithDemoNestContext(
  {
    cron: 60, // Once every hour on the hour
    timeoutSeconds: 30 // execute for 30 seconds max
  },
  async (x) => {
    await exampleUsageOfSchedule(x);
    await hourlySchedule(x);
  }
);
