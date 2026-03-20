import { type TimezoneString } from '@dereekb/util';
import { type CalcomContext } from './calcom.config';
import { type CalcomScheduleId, type CalcomResponseStatus } from '../calcom.type';
import { CALCOM_API_VERSION_SCHEDULES, calcomApiVersionHeaders } from '../shared/calcom.api-version';

export interface CalcomAvailabilityRule {
  readonly days: string[];
  readonly startTime: string;
  readonly endTime: string;
}

export interface CalcomSchedule {
  readonly id: CalcomScheduleId;
  readonly name: string;
  readonly timeZone: TimezoneString;
  readonly availability: CalcomAvailabilityRule[];
  readonly isDefault: boolean;
  readonly overrides: Record<string, CalcomAvailabilityRule[]>;
}

export interface CalcomGetSchedulesResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomSchedule[];
}

/**
 * Retrieves all schedules for the authenticated user, including availability rules and overrides.
 *
 * @see https://cal.com/docs/api-reference/v2/schedules/get-all-schedules
 *
 * @param context - the Cal.com API context providing authentication and fetch capabilities
 * @returns a function that retrieves all schedules
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
