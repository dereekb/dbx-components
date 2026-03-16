import { type Maybe } from '@dereekb/util';
import { type DbxAnalyticsUser, type DbxUserAnalyticsEvent, type DbxAnalyticsUserId } from './analytics';

/**
 * Categorizes the kind of analytics stream event emitted by {@link DbxAnalyticsService}.
 *
 * Listeners use this type to route events to the appropriate analytics provider method
 * (e.g., Segment `track()`, `identify()`, `page()`).
 */
export enum DbxAnalyticsStreamEventType {
  /** A page/screen view event, typically sent on route transitions. */
  PageView,
  /**
   * Emitted any time the user value changes, including when transitioning from defined to undefined.
   *
   * Used by listeners to update the identified user in analytics providers.
   */
  UserChange,
  /**
   * Emitted only when the user's unique ID changes, filtering out property-only updates.
   *
   * Useful for triggering identity calls without redundant updates when only traits change.
   */
  UserIdChange,

  // User Events
  /** A new user registration event. */
  NewUserEvent,
  /** A returning user login event. */
  UserLoginEvent,
  /** A user logout event. */
  UserLogoutEvent,
  /** An update to user profile properties/traits. */
  UserPropertiesEvent,

  // Events
  /** A generic custom analytics event. */
  Event
}

/**
 * Represents a single event in the analytics stream, combining the event type, payload, and user context.
 *
 * Emitted by {@link DbxAnalyticsService} and consumed by {@link DbxAnalyticsServiceListener} implementations
 * (e.g., {@link DbxAnalyticsSegmentServiceListener}) to forward events to external analytics providers.
 *
 * @example
 * ```ts
 * // Subscribe to the analytics event stream
 * analyticsService.events$.subscribe((streamEvent: DbxAnalyticsStreamEvent) => {
 *   console.log(streamEvent.type, streamEvent.event?.name, streamEvent.userId);
 * });
 * ```
 */
export interface DbxAnalyticsStreamEvent {
  readonly type: DbxAnalyticsStreamEventType;
  readonly user?: Maybe<DbxAnalyticsUser>;
  readonly event?: DbxUserAnalyticsEvent;
  readonly userId?: DbxAnalyticsUserId;
}
