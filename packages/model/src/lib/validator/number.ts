import { isMinuteOfDay } from '@dereekb/util';
import { type } from 'arktype';

/**
 * A number greater than or equal to 0.
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind const
 * @dbxUtilTags validator, arktype, number, non-negative
 * @dbxUtilRelated non-negative-integer
 *
 * @example
 * ```ts
 * type({ price: NON_NEGATIVE_NUMBER });
 * ```
 */
export const NON_NEGATIVE_NUMBER = 'number >= 0' as const;

/**
 * A non-negative integer.
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind const
 * @dbxUtilTags validator, arktype, number, non-negative, integer
 * @dbxUtilRelated non-negative-number
 *
 * @example
 * ```ts
 * type({ count: NON_NEGATIVE_INTEGER });
 * ```
 */
export const NON_NEGATIVE_INTEGER = 'number.integer >= 0' as const;

/**
 * ArkType schema for a valid minute of the day (0-1439).
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind const
 * @dbxUtilTags validator, arktype, number, minute-of-day, time
 *
 * @example
 * ```ts
 * type({ startMinute: minuteOfDayType });
 * ```
 */
export const minuteOfDayType = type('number').narrow((val, ctx) => (val != null && isMinuteOfDay(val)) || ctx.mustBe('a valid minute of the day (0-1439)'));
