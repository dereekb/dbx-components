/**
 * Cal.com API version header constants.
 *
 * Each endpoint group requires a specific cal-api-version header value.
 */
export const CALCOM_API_VERSION_SCHEDULES = '2024-06-11';
export const CALCOM_API_VERSION_SLOTS = '2024-09-04';
export const CALCOM_API_VERSION_BOOKINGS = '2024-08-13';
export const CALCOM_API_VERSION_EVENT_TYPES = '2024-06-14';
export const CALCOM_API_VERSION_CALENDARS = '2024-06-11';
export const CALCOM_API_VERSION_ME = '2024-08-13';

export type CalcomApiVersionString = string;

export const CALCOM_API_VERSION_HEADER = 'cal-api-version';

/**
 * Returns a headers object with the cal-api-version header set.
 */
export function calcomApiVersionHeaders(version: CalcomApiVersionString): Record<string, string> {
  return { [CALCOM_API_VERSION_HEADER]: version };
}
