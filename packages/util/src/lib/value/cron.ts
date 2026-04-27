import { type Minutes } from '../date/date';
import { minutesToHoursAndMinutes } from '../date/hour';

/**
 * A cron schedule expression string
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-util:cron
 */
export type CronExpression = string;

/**
 * Creates a {@link CronExpression} that repeats at approximately every N minutes.
 *
 * For values under 60, produces a cron expression using minute intervals (e.g., 5 produces every 5th minute).
 * For values of 60 or more, the expression is split into hours and minutes (e.g., 90 minutes becomes
 * every 1 hour at minute 30), which means intervals won't be exactly N minutes apart.
 *
 * @param inputMinutes - interval in minutes between executions
 * @returns a cron expression string that approximates the requested interval
 *
 * @example
 * ```ts
 * // For intervals under 60 minutes:
 * cronExpressionRepeatingEveryNMinutes(5);  // returns a cron for every 5th minute
 *
 * // For intervals of 60+ minutes:
 * cronExpressionRepeatingEveryNMinutes(90); // returns a cron for every 1 hour at minute 30
 * ```
 */
export function cronExpressionRepeatingEveryNMinutes(inputMinutes: Minutes): CronExpression {
  let expression: CronExpression;

  if (inputMinutes >= 60) {
    const { hour, minute } = minutesToHoursAndMinutes(inputMinutes);
    expression = `${minute} */${hour} * * *`; // every nth hour at the given minute
  } else {
    expression = `*/${inputMinutes} * * * *`; // every nth minute
  }

  return expression;
}
