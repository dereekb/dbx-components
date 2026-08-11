import { type EmailAddress, type TimezoneString, type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type CalcomContext } from './calcom.config';
import { type CalcomId, type CalcomUserId, type CalcomUsername, type CalcomScheduleId, type CalcomResponseStatus } from '../calcom.type';
import { CALCOM_API_VERSION_ME, calcomApiVersionHeaders } from '../shared/calcom.api-version';

/**
 * The organization a user belongs to, as embedded on the user.
 */
export interface CalcomUserOrganization {
  readonly id: CalcomId;
  readonly isPlatform: boolean;
}

export interface CalcomUser {
  readonly id: CalcomUserId;
  readonly email: EmailAddress;
  readonly name: Maybe<string>;
  readonly username: Maybe<CalcomUsername>;
  readonly timeZone: TimezoneString;
  readonly weekStart: string;
  readonly timeFormat: number;
  readonly defaultScheduleId: Maybe<CalcomScheduleId>;
  readonly avatarUrl: Maybe<WebsiteUrl>;
  readonly bio: Maybe<string>;
  readonly locale: Maybe<string>;
  readonly organizationId: Maybe<CalcomId>;
  readonly organization: Maybe<CalcomUserOrganization>;
}

export interface CalcomGetMeResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomUser;
}

/**
 * Retrieves the profile of the currently authenticated Cal.com user.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Retrieves the authenticated user's profile.
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
