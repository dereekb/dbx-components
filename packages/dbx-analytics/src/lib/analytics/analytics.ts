import { type Maybe, type PrimativeKey } from '@dereekb/util';

/**
 * Name identifier for an analytics event (e.g., `'User Registered'`, `'Page Viewed'`).
 */
export type DbxAnalyticsEventName = string;

/**
 * Unique identifier for an analytics user, typically a UID from the auth system.
 */
export type DbxAnalyticsUserId = string;

/**
 * Key-value map of user properties sent alongside identify calls to analytics providers.
 *
 * Used to enrich user profiles in tools like Segment with traits such as roles, plan type, or onboarding status.
 *
 * @example
 * ```ts
 * const properties: DbxAnalyticsUserProperties = {
 *   isOnboarded: true,
 *   role: 'admin',
 *   plan: 'pro'
 * };
 * ```
 */
export interface DbxAnalyticsUserProperties {
  readonly [key: string]: PrimativeKey | boolean;
}

/**
 * Represents a user for analytics identification, pairing a unique user ID with optional trait properties.
 *
 * Passed to analytics providers (e.g., Segment `identify()`) to associate events with a specific user.
 *
 * @example
 * ```ts
 * const user: DbxAnalyticsUser = {
 *   user: 'uid_abc123',
 *   properties: { isOnboarded: true, role: 'worker' }
 * };
 * ```
 */
export interface DbxAnalyticsUser {
  readonly user: DbxAnalyticsUserId;
  readonly properties?: DbxAnalyticsUserProperties;
}

/**
 * Key-value map of event-specific data attached to an analytics event.
 *
 * Sent as properties in `track()` calls to analytics providers.
 *
 * @example
 * ```ts
 * const data: DbxAnalyticsEventData = {
 *   code: 'PERMISSION_DENIED',
 *   seconds: 120
 * };
 * ```
 */
export interface DbxAnalyticsEventData {
  readonly [key: string]: PrimativeKey | boolean;
}

/**
 * Describes an analytics event with an optional name, numeric value, and arbitrary data payload.
 *
 * This is the core event shape emitted through {@link DbxAnalyticsService} and consumed by listeners like Segment.
 *
 * @example
 * ```ts
 * const event: DbxAnalyticsEvent = {
 *   name: 'Button Clicked',
 *   value: 1,
 *   data: { buttonId: 'submit-form' }
 * };
 * ```
 */
export interface DbxAnalyticsEvent {
  readonly name?: DbxAnalyticsEventName;
  readonly value?: number;
  readonly data?: DbxAnalyticsEventData;
}

/**
 * Extends {@link DbxAnalyticsEvent} with an optional user association.
 *
 * Used internally by {@link DbxAnalyticsService} to attach the current user context to each emitted event.
 */
export interface DbxUserAnalyticsEvent extends DbxAnalyticsEvent {
  readonly user?: Maybe<DbxAnalyticsUser>;
}

// MARK: New User
/**
 * Registration method used to create a new user account (e.g., `'facebook'`, `'google'`, `'email'`).
 */
export type NewUserRegistrationMethod = 'facebook' | 'google' | 'email' | string;

/**
 * Event data for new user registration events, requiring the registration method.
 *
 * @example
 * ```ts
 * const data: NewUserAnalyticsEventData = {
 *   method: 'google'
 * };
 * ```
 */
export interface NewUserAnalyticsEventData extends DbxAnalyticsEventData {
  method: NewUserRegistrationMethod;
}
