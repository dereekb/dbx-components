import { isISO8601DayString } from '@dereekb/util';
import { type } from 'arktype';

/**
 * ArkType schema for a valid ISO 8601 day string (e.g., "2024-01-15").
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind const
 * @dbxUtilTags validator, arktype, date, iso8601, day, string
 *
 * @example
 * ```ts
 * type({ startsOn: iso8601DayStringType });
 * ```
 */
export const iso8601DayStringType = type('string > 0').narrow((val, ctx) => (val != null && isISO8601DayString(val)) || ctx.mustBe('a valid ISO 8601 day string'));
