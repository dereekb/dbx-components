import { Hours, Minutes } from '../date/date';
import { Maybe } from './maybe.type';

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
  let minutes: Minutes;
  let hours: Maybe<Hours>;

  let expression: CronExpression;

  if (inputMinutes >= 60) {
    hours = Math.floor(inputMinutes / 60);
    minutes = inputMinutes % 60;

    expression = `${minutes} */${hours} * * *`; // every nth hour at the given minute
  } else {
    expression = `*/${inputMinutes} * * * *`; // every nth minute
  }

  return expression;
}
