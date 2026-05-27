import { isMinuteOfDay } from '@dereekb/util';
import { type } from 'arktype';

/**
 * A number greater than or equal to 0.
 */
export const NON_NEGATIVE_NUMBER = 'number >= 0' as const;

/**
 * A non-negative integer.
 */
export const NON_NEGATIVE_INTEGER = 'number.integer >= 0' as const;

/**
 * ArkType schema for a valid minute of the day (0-1439).
 */
export const minuteOfDayType = type('number').narrow((val, ctx) => (val != null && isMinuteOfDay(val)) || ctx.mustBe('a valid minute of the day (0-1439)'));
