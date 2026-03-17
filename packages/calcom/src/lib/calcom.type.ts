/**
 * A numeric identifier in Cal.com.
 */
export type CalcomId = number;

/**
 * Cal.com user identifier.
 */
export type CalcomUserId = number;

/**
 * Cal.com event type identifier.
 */
export type CalcomEventTypeId = number;

/**
 * Cal.com booking identifier.
 */
export type CalcomBookingId = number;

/**
 * Cal.com schedule identifier.
 */
export type CalcomScheduleId = number;

/**
 * Cal.com webhook identifier.
 */
export type CalcomWebhookId = number;

/**
 * Cal.com credential identifier, used to reference connected calendar credentials.
 */
export type CalcomCredentialId = number;

/**
 * Cal.com booking UID string. A unique string identifier for a booking,
 * distinct from the numeric booking ID.
 */
export type CalcomBookingUid = string;

/**
 * Cal.com username. Used to identify a user in public-facing URLs
 * (e.g., cal.com/{username}/{event-slug}).
 */
export type CalcomUsername = string;

/**
 * Cal.com event type slug. A URL-safe string identifying an event type
 * (e.g., "30-minute-meeting").
 */
export type CalcomEventTypeSlug = string;

/**
 * Cal.com team slug. A URL-safe string identifying a team
 * (e.g., "engineering-team").
 */
export type CalcomTeamSlug = string;

/**
 * Cal.com organization slug. A URL-safe string identifying an organization.
 */
export type CalcomOrganizationSlug = string;

/**
 * Cal.com calendar integration identifier string
 * (e.g., "google_calendar", "outlook_calendar", "apple_calendar").
 */
export type CalcomCalendarIntegration = string;

/**
 * Cal.com webhook event type string
 * (e.g., "BOOKING_CREATED", "BOOKING_CANCELLED").
 */
export type CalcomWebhookEventTypeString = string;

/**
 * Cal.com API response status string (e.g., "success", "error").
 */
export type CalcomResponseStatus = 'success' | 'error';

/**
 * Cal.com booking status string.
 */
export type CalcomBookingStatus = 'accepted' | 'pending' | 'cancelled' | 'rejected';
