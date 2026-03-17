import { type EmailAddress, type ISO8601DateString, type Maybe } from '@dereekb/util';
import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type CalcomContext } from './calcom.config';
import { type CalcomId, type CalcomCredentialId, type CalcomCalendarIntegration, type CalcomUserId, type CalcomEventTypeId, type CalcomResponseStatus } from '../calcom.type';
import { CALCOM_API_VERSION_CALENDARS, calcomApiVersionHeaders } from '../shared/calcom.api-version';

export interface CalcomCalendar {
  readonly externalId: string;
  readonly integration: CalcomCalendarIntegration;
  readonly name: string;
  readonly readOnly: boolean;
  readonly email: EmailAddress;
  readonly isSelected: boolean;
  readonly credentialId: CalcomCredentialId;
}

export interface CalcomConnectedCalendar {
  readonly integration: CalcomCalendarIntegration;
  readonly credentialId: CalcomCredentialId;
  readonly primary: {
    readonly calendars: CalcomCalendar[];
  };
}

export interface CalcomDestinationCalendar {
  readonly id: CalcomId;
  readonly integration: CalcomCalendarIntegration;
  readonly externalId: string;
  readonly primaryEmail: EmailAddress;
  readonly name: string;
  readonly readOnly: boolean;
  readonly email: EmailAddress;
  readonly isSelected: boolean;
  readonly credentialId: CalcomCredentialId;
  readonly userId: CalcomUserId;
  readonly eventTypeId: Maybe<CalcomEventTypeId>;
  readonly integrationTitle: string;
}

export interface CalcomGetCalendarsResponseData {
  readonly connectedCalendars: CalcomConnectedCalendar[];
  readonly destinationCalendar: Maybe<CalcomDestinationCalendar>;
}

export interface CalcomGetCalendarsResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomGetCalendarsResponseData;
}

export interface CalcomGetBusyTimesInput {
  readonly dateFrom: ISO8601DateString;
  readonly dateTo: ISO8601DateString;
  readonly calendarsToLoad?: Maybe<string[]>;
}

export interface CalcomBusyTime {
  readonly start: ISO8601DateString;
  readonly end: ISO8601DateString;
  readonly source?: Maybe<string>;
}

export interface CalcomGetBusyTimesResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomBusyTime[];
}

/**
 * Retrieves all connected calendars and the destination calendar for the authenticated user.
 *
 * @see https://cal.com/docs/api-reference/v2/calendars/get-all-calendars
 *
 * @example
 * ```ts
 * const response = await getCalendars(context)();
 * response.data.connectedCalendars.forEach(cc => console.log(cc.integration));
 * ```
 */
export function getCalendars(context: CalcomContext): () => Promise<CalcomGetCalendarsResponse> {
  return () => context.fetchJson('/calendars', { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_CALENDARS) });
}

/**
 * Retrieves busy time ranges across the user's connected calendars for a given date range.
 *
 * @see https://cal.com/docs/api-reference/v2/calendars/get-busy-times
 *
 * @example
 * ```ts
 * const response = await getBusyTimes(context)({
 *   dateFrom: '2026-03-17',
 *   dateTo: '2026-03-24'
 * });
 * response.data.forEach(bt => console.log(bt.start, bt.end));
 * ```
 */
export function getBusyTimes(context: CalcomContext): (input: CalcomGetBusyTimesInput) => Promise<CalcomGetBusyTimesResponse> {
  return (input) => {
    const params = makeUrlSearchParams({
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      calendarsToLoad: input.calendarsToLoad?.join(',')
    });

    return context.fetchJson(`/calendars/busy-times?${params}`, {
      method: 'GET',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_CALENDARS)
    });
  };
}
