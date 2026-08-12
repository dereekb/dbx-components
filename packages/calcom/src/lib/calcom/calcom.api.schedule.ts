import { type ISO8601DayString, type TimezoneString } from '@dereekb/util';
import { type CalcomContext } from './calcom.config';
import { type CalcomScheduleId, type CalcomResponseStatus, type CalcomUserId } from '../calcom.type';
import { CALCOM_API_VERSION_SCHEDULES, calcomApiVersionHeaders } from '../shared/calcom.api-version';

export interface CalcomAvailabilityRule {
  readonly days: string[];
  readonly startTime: string;
  readonly endTime: string;
}

/**
 * A date-specific exception to a schedule's weekly availability.
 *
 * NOTE: the array itself is confirmed against the live API, but this entry shape is taken from
 * the Cal.com docs — the account used to verify this package has no overrides configured, so no
 * real entry was observed. Treat the field names as unverified.
 */
export interface CalcomScheduleOverride {
  readonly date: ISO8601DayString;
  readonly startTime: string;
  readonly endTime: string;
}

export interface CalcomSchedule {
  readonly id: CalcomScheduleId;
  readonly ownerId: CalcomUserId;
  readonly name: string;
  readonly timeZone: TimezoneString;
  readonly availability: CalcomAvailabilityRule[];
  readonly isDefault: boolean;
  /**
   * Date-specific overrides, returned as an ARRAY (not a date-keyed record).
   */
  readonly overrides: CalcomScheduleOverride[];
}

export interface CalcomGetSchedulesResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomSchedule[];
}

/**
 * Retrieves all schedules for the authenticated user, including availability rules and overrides.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Retrieves all schedules.
 *
 * @see https://cal.com/docs/api-reference/v2/schedules/get-all-schedules
 *
 * @example
 * ```ts
 * const response = await getSchedules(context)();
 * response.data.forEach(schedule => console.log(schedule.name, schedule.timeZone));
 * ```
 */
export function getSchedules(context: CalcomContext): () => Promise<CalcomGetSchedulesResponse> {
  return () => context.fetchJson('/schedules', { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_SCHEDULES) });
}
