import { exampleUsageOfSchedule } from '../example/example.schedule';
import { onScheduleWithDemoNestContext } from '../function';

// MARK: Example
export const demoExampleUsageOfSchedule = onScheduleWithDemoNestContext(
  {
    cron: 1
  },
  exampleUsageOfSchedule
);
