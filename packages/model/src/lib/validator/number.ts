import { isMinuteOfDay } from '@dereekb/util';
import { type } from 'arktype';

/**
 * ArkType schema for a valid minute of the day (0-1439).
 */
export const minuteOfDayType = type('number').narrow((val, ctx) => (val != null && isMinuteOfDay(val)) || ctx.mustBe('a valid minute of the day (0-1439)'));
