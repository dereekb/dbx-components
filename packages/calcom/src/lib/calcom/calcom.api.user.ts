import { type EmailAddress, type ISO8601DateString, type TimezoneString } from '@dereekb/util';
import { type CalcomContext } from './calcom.config';
import { type CalcomUserId, type CalcomUsername, type CalcomScheduleId, type CalcomResponseStatus } from '../calcom.type';
import { CALCOM_API_VERSION_ME, calcomApiVersionHeaders } from '../shared/calcom.api-version';

export interface CalcomUser {
  readonly id: CalcomUserId;
  readonly email: EmailAddress;
  readonly username: CalcomUsername | null;
  readonly timeZone: TimezoneString;
  readonly weekStart: string;
  readonly createdDate: ISO8601DateString;
  readonly timeFormat: number;
  readonly defaultScheduleId: CalcomScheduleId | null;
}

export interface CalcomGetMeResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomUser;
}

/**
 * Retrieves the profile of the currently authenticated Cal.com user.
 *
 * @see https://cal.com/docs/api-reference/v2/me
 *
 * @example
 * ```ts
 * const response = await getMe(context)();
 * console.log(response.data.email);
 * ```
 */
export function getMe(context: CalcomContext): () => Promise<CalcomGetMeResponse> {
  return () => context.fetchJson('/me', { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_ME) });
}
