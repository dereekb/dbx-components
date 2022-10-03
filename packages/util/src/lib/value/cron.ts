import { Minutes } from '../date/date';

/**
 * A cron schedule expression string
 */
export type CronExpression = string;

export function cronExpressionRepeatingEveryNMinutes(minutes: Minutes): CronExpression {
  return `*/${minutes} * * * *`; // every nth minute
}
