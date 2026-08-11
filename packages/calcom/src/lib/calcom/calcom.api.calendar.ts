import { type EmailAddress, type ISO8601DateString, type ISO8601DayString, type Maybe, type TimezoneString, type WebsiteUrl } from '@dereekb/util';
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
  /**
   * Whether Cal.com checks this calendar for conflicts.
   *
   * This is the flag to filter on when loading busy times; it is independent of {@link primary},
   * and an account commonly has a selected calendar that is not its primary one.
   */
  readonly isSelected: boolean;
  /**
   * Whether this is the primary calendar of the connection. Null on non-primary calendars.
   */
  readonly primary: Maybe<boolean>;
  readonly credentialId: CalcomCredentialId;
  readonly delegationCredentialId: Maybe<CalcomId>;
}

/**
 * App metadata describing the integration behind a connected calendar.
 *
 * Note this is an OBJECT, distinct from the {@link CalcomCalendarIntegration} string
 * (e.g. `"google_calendar"`) carried on each individual {@link CalcomCalendar}.
 */
export interface CalcomCalendarIntegrationApp {
  readonly name: string;
  readonly type: CalcomCalendarIntegration;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly variant: string;
  readonly category: string;
  readonly categories: string[];
  readonly logo: string;
  readonly publisher: string;
  readonly url: WebsiteUrl;
  readonly email: EmailAddress;
  readonly installed: boolean;
  readonly isOAuth: boolean;
  readonly dirName: Maybe<string>;
  readonly locationOption: Maybe<unknown>;
  readonly appData: Maybe<unknown>;
  readonly delegationCredential: Maybe<unknown>;
}

export interface CalcomConnectedCalendar {
  readonly integration: CalcomCalendarIntegrationApp;
  readonly credentialId: CalcomCredentialId;
  readonly delegationCredentialId: Maybe<CalcomId>;
  /**
   * The primary calendar of this connection, as a single calendar.
   */
  readonly primary: Maybe<CalcomCalendar>;
  /**
   * Every calendar available on this connection, as a sibling of {@link primary}.
   */
  readonly calendars: CalcomCalendar[];
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
  readonly delegationCredentialId: Maybe<CalcomId>;
  readonly userId: CalcomUserId;
  readonly eventTypeId: Maybe<CalcomEventTypeId>;
  readonly integrationTitle: string;
  readonly createdAt: ISO8601DateString;
  readonly updatedAt: ISO8601DateString;
}

export interface CalcomGetCalendarsResponseData {
  readonly connectedCalendars: CalcomConnectedCalendar[];
  readonly destinationCalendar: Maybe<CalcomDestinationCalendar>;
}

export interface CalcomGetCalendarsResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomGetCalendarsResponseData;
}

/**
 * Addresses a single calendar to load busy times from.
 *
 * Both halves are required: the endpoint matches a calendar by its external id within a
 * specific credential, and rejects the request when either is missing.
 */
export interface CalcomCalendarToLoad {
  readonly credentialId: CalcomCredentialId;
  readonly externalId: string;
}

export interface CalcomGetBusyTimesInputBase {
  /**
   * Accepts either a plain day (`2026-08-01`) or a full ISO instant.
   */
  readonly dateFrom: ISO8601DateString | ISO8601DayString;
  readonly dateTo: ISO8601DateString | ISO8601DayString;
  /**
   * The calendars to load, obtained from {@link getCalendars}.
   *
   * Encoded as an indexed object array (`calendarsToLoad[0][credentialId]=…`); the endpoint
   * rejects any scalar form with "calendarsToLoad must be an array".
   */
  readonly calendarsToLoad: CalcomCalendarToLoad[];
}

/**
 * The endpoint rejects a request carrying neither timezone with
 * "Either timeZone or loggedInUsersTz must be provided", so at least one is required.
 */
export type CalcomGetBusyTimesTimezoneInput = { readonly timeZone: TimezoneString; readonly loggedInUsersTz?: Maybe<TimezoneString> } | { readonly timeZone?: Maybe<TimezoneString>; readonly loggedInUsersTz: TimezoneString };

export type CalcomGetBusyTimesInput = CalcomGetBusyTimesInputBase & CalcomGetBusyTimesTimezoneInput;

/**
 * Input for {@link getBusyTimesForConnectedCalendars}, which derives `calendarsToLoad` itself.
 */
export type CalcomGetBusyTimesForConnectedCalendarsInput = Omit<CalcomGetBusyTimesInputBase, 'calendarsToLoad'> & CalcomGetBusyTimesTimezoneInput;

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
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Retrieves all connected calendars.
 *
 * @see https://cal.com/docs/api-reference/v2/calendars/get-all-calendars
 *
 * @example
 * ```ts
 * const response = await getCalendars(context)();
 * response.data.connectedCalendars.forEach(cc => console.log(cc.integration.slug, cc.calendars.length));
 * ```
 */
export function getCalendars(context: CalcomContext): () => Promise<CalcomGetCalendarsResponse> {
  return () => context.fetchJson('/calendars', { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_CALENDARS) });
}

/**
 * Selects the calendars to load busy times from, out of a set of connected calendars.
 *
 * Prefers the calendars Cal.com is configured to check for conflicts (`isSelected`), and falls
 * back to a connection's primary calendar when that connection has nothing selected.
 *
 * @param connectedCalendars - The connected calendars to select from.
 * @returns The calendars to load.
 */
export function calcomCalendarsToLoadFromConnectedCalendars(connectedCalendars: CalcomConnectedCalendar[]): CalcomCalendarToLoad[] {
  return connectedCalendars.flatMap((connection) => {
    const selectedCalendars = connection.calendars.filter((x) => x.isSelected);
    const primaryCalendars = connection.primary ? [connection.primary] : [];
    const calendars = selectedCalendars.length > 0 ? selectedCalendars : primaryCalendars;
    return calendars.map((x) => ({ credentialId: x.credentialId, externalId: x.externalId }));
  });
}

/**
 * Retrieves busy time ranges across the given calendars for a date range.
 *
 * A caller cannot address this endpoint without first knowing its calendars, so this is the
 * single-request primitive — see {@link getBusyTimesForConnectedCalendars} to resolve them too.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Retrieves busy time ranges for a date range.
 *
 * @see https://cal.com/docs/api-reference/v2/calendars/get-busy-times
 *
 * @example
 * ```ts
 * const response = await getBusyTimes(context)({
 *   dateFrom: '2026-03-17',
 *   dateTo: '2026-03-24',
 *   timeZone: 'America/Chicago',
 *   calendarsToLoad: [{ credentialId: 1845764, externalId: 'someone@example.com' }]
 * });
 * response.data.forEach(bt => console.log(bt.start, bt.end));
 * ```
 */
export function getBusyTimes(context: CalcomContext): (input: CalcomGetBusyTimesInput) => Promise<CalcomGetBusyTimesResponse> {
  return (input) => {
    const params = makeUrlSearchParams(
      {
        timeZone: input.timeZone,
        loggedInUsersTz: input.loggedInUsersTz,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        calendarsToLoad: input.calendarsToLoad
      },
      { useBracketNotation: true }
    );

    return context.fetchJson(`/calendars/busy-times?${params}`, {
      method: 'GET',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_CALENDARS)
    });
  };
}

/**
 * Retrieves busy time ranges across the user's connected calendars for a date range.
 *
 * Convenience over {@link getBusyTimes}: loads the connected calendars first and derives
 * `calendarsToLoad` via {@link calcomCalendarsToLoadFromConnectedCalendars}, so a caller does not
 * have to know Cal.com's `isSelected`/primary selection rule. Issues two requests.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Retrieves busy time ranges across the user's connected calendars.
 *
 * @example
 * ```ts
 * const response = await getBusyTimesForConnectedCalendars(context)({
 *   dateFrom: '2026-03-17',
 *   dateTo: '2026-03-24',
 *   loggedInUsersTz: 'UTC'
 * });
 * ```
 */
export function getBusyTimesForConnectedCalendars(context: CalcomContext): (input: CalcomGetBusyTimesForConnectedCalendarsInput) => Promise<CalcomGetBusyTimesResponse> {
  return async (input) => {
    const calendarsResponse = await getCalendars(context)();
    const calendarsToLoad = calcomCalendarsToLoadFromConnectedCalendars(calendarsResponse.data.connectedCalendars);
    return getBusyTimes(context)({ ...input, calendarsToLoad } as CalcomGetBusyTimesInput);
  };
}
