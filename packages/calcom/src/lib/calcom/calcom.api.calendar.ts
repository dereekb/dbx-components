import { type Maybe } from '@dereekb/util';
import { makeUrlSearchParams } from '@dereekb/util/fetch';
import { type CalcomContext } from './calcom.config';
import { CALCOM_API_VERSION_CALENDARS, calcomApiVersionHeaders } from '../shared/calcom.api-version';

export interface CalcomCalendar {
  readonly externalId: string;
  readonly integration: string;
  readonly name: string;
  readonly readOnly: boolean;
  readonly email: string;
  readonly isSelected: boolean;
  readonly credentialId: number;
}

export interface CalcomConnectedCalendar {
  readonly integration: string;
  readonly credentialId: number;
  readonly primary: {
    readonly calendars: CalcomCalendar[];
  };
}

export interface CalcomDestinationCalendar {
  readonly integration: string;
  readonly externalId: string;
  readonly name: string;
  readonly credentialId: number;
}

export interface CalcomGetCalendarsResponse {
  readonly connectedCalendars: CalcomConnectedCalendar[];
  readonly destinationCalendar: Maybe<CalcomDestinationCalendar>;
}

export interface CalcomGetBusyTimesInput {
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly calendarsToLoad?: Maybe<string[]>;
}

export interface CalcomBusyTime {
  readonly start: string;
  readonly end: string;
  readonly source?: Maybe<string>;
}

export interface CalcomGetBusyTimesResponse {
  readonly status: string;
  readonly data: CalcomBusyTime[];
}

export function getCalendars(context: CalcomContext): () => Promise<CalcomGetCalendarsResponse> {
  return () => context.fetchJson('/calendars', { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_CALENDARS) });
}

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
