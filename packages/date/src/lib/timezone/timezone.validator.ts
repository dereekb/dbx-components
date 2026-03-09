import { type } from 'arktype';
import { isKnownTimezone } from './timezone';

/**
 * ArkType schema that validates a string is a recognized IANA timezone.
 *
 * Delegates to {@link isKnownTimezone} for the actual check.
 *
 * @example
 * ```ts
 * const result = knownTimezoneType('America/Denver');
 * ```
 */
export const knownTimezoneType = type('string > 0').narrow((val, ctx) => isKnownTimezone(val) || ctx.mustBe('a known timezone'));
