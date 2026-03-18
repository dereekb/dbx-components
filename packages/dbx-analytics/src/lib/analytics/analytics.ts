import type { AnalyticsEventName, AnalyticsUserId, AnalyticsUserProperties, AnalyticsUser, AnalyticsEventData, AnalyticsEvent, UserAnalyticsEvent, NewUserRegistrationMethod, NewUserAnalyticsEventData } from '@dereekb/analytics';

// Re-export canonical types directly
export type { AnalyticsEventName, AnalyticsUserId, AnalyticsUserProperties, AnalyticsUser, AnalyticsEventData, AnalyticsEvent, UserAnalyticsEvent, NewUserRegistrationMethod, NewUserAnalyticsEventData } from '@dereekb/analytics';

// MARK: Compat - Deprecated Dbx-prefixed aliases
/** @deprecated Use {@link AnalyticsEventName} from `@dereekb/analytics` instead. */
export type DbxAnalyticsEventName = AnalyticsEventName;
/** @deprecated Use {@link AnalyticsUserId} from `@dereekb/analytics` instead. */
export type DbxAnalyticsUserId = AnalyticsUserId;
/** @deprecated Use {@link AnalyticsUserProperties} from `@dereekb/analytics` instead. */
export type DbxAnalyticsUserProperties = AnalyticsUserProperties;
/** @deprecated Use {@link AnalyticsUser} from `@dereekb/analytics` instead. */
export type DbxAnalyticsUser = AnalyticsUser;
/** @deprecated Use {@link AnalyticsEventData} from `@dereekb/analytics` instead. */
export type DbxAnalyticsEventData = AnalyticsEventData;
/** @deprecated Use {@link AnalyticsEvent} from `@dereekb/analytics` instead. */
export type DbxAnalyticsEvent = AnalyticsEvent;
/** @deprecated Use {@link UserAnalyticsEvent} from `@dereekb/analytics` instead. */
export type DbxUserAnalyticsEvent = UserAnalyticsEvent;
