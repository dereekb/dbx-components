import { type Minutes, type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type CalcomContext } from './calcom.config';
import { type CalcomEventTypeId, type CalcomEventTypeSlug, type CalcomResponseStatus, type CalcomScheduleId, type CalcomUserId } from '../calcom.type';
import { CALCOM_API_VERSION_EVENT_TYPES, calcomApiVersionHeaders } from '../shared/calcom.api-version';

/**
 * A toggleable event-type policy, returned either disabled or with its configuration.
 *
 * Cal.com models several independent settings this way (`confirmationPolicy`, `bookingWindow`,
 * `seats`, `bookerActiveBookingsLimit`), each as `{ disabled: true }` or a settings object.
 */
export type CalcomEventTypePolicy = { readonly disabled: true } | Record<string, unknown>;

/**
 * A boolean event-type setting Cal.com wraps in an object rather than sending bare.
 *
 * `disableCancelling`/`disableRescheduling` are `{ disabled: false }` on the wire in BOTH
 * directions — the response never carries a bare boolean (so `if (eventType.disableCancelling)`
 * on one would always be truthy), and passing one to create/update is rejected with "nested
 * property disableCancelling must be either object or array".
 */
export interface CalcomEventTypeDisabledPolicy {
  readonly disabled: boolean;
}

export interface CalcomEventType {
  readonly id: CalcomEventTypeId;
  readonly ownerId: CalcomUserId;
  readonly title: string;
  readonly slug: CalcomEventTypeSlug;
  readonly description: Maybe<string>;
  readonly lengthInMinutes: Minutes;
  /**
   * The selectable lengths of a multi-length event type. Absent on a fixed-length event type —
   * which is exactly when `lengthInMinutes` may NOT be passed to create-booking.
   */
  readonly lengthInMinutesOptions?: Maybe<Minutes[]>;
  readonly locations: unknown[];
  readonly bookingFields: unknown[];
  readonly hidden: boolean;
  readonly scheduleId: Maybe<CalcomScheduleId>;
  readonly slotInterval: Maybe<Minutes>;
  readonly minimumBookingNotice: Minutes;
  readonly beforeEventBuffer: Minutes;
  readonly afterEventBuffer: Minutes;
  readonly offsetStart: Minutes;
  readonly disableGuests: boolean;
  readonly hideCalendarNotes: boolean;
  readonly hideCalendarEventDetails: boolean;
  readonly hideOrganizerEmail: boolean;
  readonly requiresBookerEmailVerification: boolean;
  readonly skipAttendeeEmailDeliverabilityCheck: boolean;
  readonly lockTimeZoneToggleOnBookingPage: boolean;
  readonly onlyShowFirstAvailableSlot: boolean;
  readonly showOptimizedSlots: boolean;
  readonly isInstantEvent: boolean;
  readonly useDestinationCalendarEmail: boolean;
  readonly bookingRequiresAuthentication: boolean;
  readonly disableCancelling: CalcomEventTypeDisabledPolicy;
  readonly disableRescheduling: CalcomEventTypeDisabledPolicy;
  readonly allowReschedulingPastBookings: boolean;
  readonly allowReschedulingCancelledBookings: boolean;
  readonly forwardParamsSuccessRedirect: boolean;
  readonly successRedirectUrl: Maybe<WebsiteUrl>;
  readonly bookingUrl: Maybe<WebsiteUrl>;
  readonly interfaceLanguage: Maybe<string>;
  readonly price: number;
  readonly currency: string;
  readonly recurrence: Maybe<unknown>;
  readonly metadata: Record<string, unknown>;
  readonly users: unknown[];
  readonly calVideoSettings: Maybe<Record<string, unknown>>;
  readonly confirmationPolicy: CalcomEventTypePolicy;
  readonly bookingWindow: CalcomEventTypePolicy;
  readonly seats: CalcomEventTypePolicy;
  readonly bookerActiveBookingsLimit: CalcomEventTypePolicy;
  readonly privateNoteEnabled: boolean;
  readonly privateNoteMode: Maybe<string>;
  readonly privateNoteTemplate: Maybe<string>;
}

export interface CalcomGetEventTypesResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomEventType[];
}

export interface CalcomEventTypeResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomEventType;
}

/**
 * The event-type settings accepted on both create and update.
 */
export interface CalcomEventTypeInputSettings {
  readonly description?: Maybe<string>;
  readonly locations?: Maybe<unknown[]>;
  readonly bookingFields?: Maybe<unknown[]>;
  /**
   * The selectable lengths of a multi-length event type. Required before a booking may pass
   * `lengthInMinutes`.
   */
  readonly lengthInMinutesOptions?: Maybe<Minutes[]>;
  readonly hidden?: Maybe<boolean>;
  readonly scheduleId?: Maybe<CalcomScheduleId>;
  readonly slotInterval?: Maybe<Minutes>;
  readonly minimumBookingNotice?: Maybe<Minutes>;
  readonly beforeEventBuffer?: Maybe<Minutes>;
  readonly afterEventBuffer?: Maybe<Minutes>;
  readonly offsetStart?: Maybe<Minutes>;
  readonly disableGuests?: Maybe<boolean>;
  readonly hideCalendarNotes?: Maybe<boolean>;
  readonly hideCalendarEventDetails?: Maybe<boolean>;
  readonly hideOrganizerEmail?: Maybe<boolean>;
  readonly requiresBookerEmailVerification?: Maybe<boolean>;
  /**
   * Skips Cal.com's deliverability check on the attendee email, which otherwise rejects
   * addresses it cannot verify.
   */
  readonly skipAttendeeEmailDeliverabilityCheck?: Maybe<boolean>;
  readonly lockTimeZoneToggleOnBookingPage?: Maybe<boolean>;
  readonly onlyShowFirstAvailableSlot?: Maybe<boolean>;
  readonly useDestinationCalendarEmail?: Maybe<boolean>;
  readonly bookingRequiresAuthentication?: Maybe<boolean>;
  readonly disableCancelling?: Maybe<CalcomEventTypeDisabledPolicy>;
  readonly disableRescheduling?: Maybe<CalcomEventTypeDisabledPolicy>;
  readonly allowReschedulingPastBookings?: Maybe<boolean>;
  readonly allowReschedulingCancelledBookings?: Maybe<boolean>;
  readonly forwardParamsSuccessRedirect?: Maybe<boolean>;
  readonly successRedirectUrl?: Maybe<WebsiteUrl>;
  readonly interfaceLanguage?: Maybe<string>;
  readonly price?: Maybe<number>;
  readonly currency?: Maybe<string>;
  readonly recurrence?: Maybe<unknown>;
  readonly metadata?: Maybe<Record<string, unknown>>;
  readonly confirmationPolicy?: Maybe<CalcomEventTypePolicy>;
  readonly bookingWindow?: Maybe<CalcomEventTypePolicy>;
  readonly seats?: Maybe<CalcomEventTypePolicy>;
  readonly bookerActiveBookingsLimit?: Maybe<CalcomEventTypePolicy>;
}

export interface CalcomCreateEventTypeInput extends CalcomEventTypeInputSettings {
  readonly title: string;
  readonly slug: CalcomEventTypeSlug;
  readonly lengthInMinutes: Minutes;
}

export interface CalcomUpdateEventTypeInput extends CalcomEventTypeInputSettings {
  readonly title?: Maybe<string>;
  readonly slug?: Maybe<CalcomEventTypeSlug>;
  readonly lengthInMinutes?: Maybe<Minutes>;
}

/**
 * Retrieves all event types for the authenticated user.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Retrieves all event types.
 *
 * @see https://cal.com/docs/api-reference/v2/event-types/get-all-event-types
 *
 * @example
 * ```ts
 * const response = await getEventTypes(context)();
 * response.data.forEach(et => console.log(et.title, et.slug, et.lengthInMinutes));
 * ```
 */
export function getEventTypes(context: CalcomContext): () => Promise<CalcomGetEventTypesResponse> {
  return () => context.fetchJson('/event-types', { method: 'GET', headers: calcomApiVersionHeaders(CALCOM_API_VERSION_EVENT_TYPES) });
}

/**
 * Creates a new event type for the authenticated user.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Creates a new event type from the given input.
 *
 * @see https://cal.com/docs/api-reference/v2/event-types/create-an-event-type
 *
 * @example
 * ```ts
 * const response = await createEventType(context)({
 *   title: 'Mentoring Session',
 *   slug: 'mentoring-session',
 *   lengthInMinutes: 30
 * });
 * console.log(response.data.id);
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createEventType(context: CalcomContext): (input: CalcomCreateEventTypeInput) => Promise<CalcomEventTypeResponse> {
  return (input) =>
    context.fetchJson('/event-types', {
      method: 'POST',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_EVENT_TYPES),
      body: JSON.stringify(input)
    });
}

/**
 * Updates an existing event type by ID.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Updates an event type by ID.
 *
 * @see https://cal.com/docs/api-reference/v2/event-types/update-an-event-type
 *
 * @example
 * ```ts
 * await updateEventType(context)(12345, { title: 'Updated Session Title' });
 * ```
 */
export function updateEventType(context: CalcomContext): (eventTypeId: CalcomEventTypeId, input: CalcomUpdateEventTypeInput) => Promise<CalcomEventTypeResponse> {
  return (eventTypeId, input) =>
    context.fetchJson(`/event-types/${eventTypeId}`, {
      method: 'PATCH',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_EVENT_TYPES),
      body: JSON.stringify(input)
    });
}

/**
 * Deletes an event type by ID.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Deletes an event type by ID.
 *
 * @see https://cal.com/docs/api-reference/v2/event-types/delete-an-event-type
 *
 * @example
 * ```ts
 * await deleteEventType(context)(12345);
 * ```
 */
export function deleteEventType(context: CalcomContext): (eventTypeId: CalcomEventTypeId) => Promise<CalcomEventTypeResponse> {
  return (eventTypeId) =>
    context.fetchJson(`/event-types/${eventTypeId}`, {
      method: 'DELETE',
      headers: calcomApiVersionHeaders(CALCOM_API_VERSION_EVENT_TYPES)
    });
}
