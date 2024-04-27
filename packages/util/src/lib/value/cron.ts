import { type Minutes } from '../date/date';
import { minutesToHoursAndMinutes } from '../date/hour';

/**
 * A cron schedule expression string
 */
export type CronExpression = string;

/**
 * Creates a CronExpression for the input number of minutes.
 *
 * Note that if the number of minutes is greater than 60, it will generate an expression that
 * isn't exactly n number of minutes apart from the previous execution, but instead create
 * an expression that is n/60 hours apart and take place on the n%60th minute.
 *
 * @param inputMinutes
 * @returns
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
