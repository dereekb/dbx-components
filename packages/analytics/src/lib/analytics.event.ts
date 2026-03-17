import { type Maybe, type PrimativeKey } from '@dereekb/util';

/**
 * Name identifier for an analytics event (e.g., `'User Registered'`, `'Page Viewed'`).
 */
export type AnalyticsEventName = string;

/**
 * Unique identifier for an analytics user, typically a UID from the auth system.
 */
export type AnalyticsUserId = string;

/**
 * Key-value map of user properties sent alongside identify calls to analytics providers.
 *
 * Used to enrich user profiles in tools like Segment with traits such as roles, plan type, or onboarding status.
 */
export interface AnalyticsUserProperties {
  readonly [key: string]: PrimativeKey | boolean;
}

/**
 * Represents a user for analytics identification, pairing a unique user ID with optional trait properties.
 *
 * Passed to analytics providers (e.g., Segment `identify()`) to associate events with a specific user.
 */
export interface AnalyticsUser {
  readonly user: AnalyticsUserId;
  readonly properties?: AnalyticsUserProperties;
}

/**
 * Key-value map of event-specific data attached to an analytics event.
 *
 * Sent as properties in `track()` calls to analytics providers.
 */
export interface AnalyticsEventData {
  readonly [key: string]: PrimativeKey | boolean;
}

/**
 * Describes an analytics event with an optional name, numeric value, and arbitrary data payload.
 *
 * This is the core event shape emitted through analytics services and consumed by listeners like Segment.
 */
export interface AnalyticsEvent {
  readonly name?: AnalyticsEventName;
  readonly value?: number;
  readonly data?: AnalyticsEventData;
}

/**
 * Extends {@link AnalyticsEvent} with an optional user association.
 *
 * Used to attach the current user context to each emitted event.
 */
export interface UserAnalyticsEvent extends AnalyticsEvent {
  readonly user?: Maybe<AnalyticsUser>;
}

// MARK: New User
/**
 * Registration method used to create a new user account (e.g., `'facebook'`, `'google'`, `'email'`).
 */
export type NewUserRegistrationMethod = 'facebook' | 'google' | 'email' | string;

/**
 * Event data for new user registration events, requiring the registration method.
 */
export interface NewUserAnalyticsEventData extends AnalyticsEventData {
  method: NewUserRegistrationMethod;
}
