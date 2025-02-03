import { type Maybe } from '@dereekb/util';
import { DbxAnalyticsUser, DbxUserAnalyticsEvent, DbxAnalyticsUserId } from './analytics';

export enum DbxAnalyticsStreamEventType {
  PageView,
  /**
   * Emitted any time the user value changes.
   *
   * Can emit when the user goes from defined to undefined.
   */
  UserChange,
  /**
   * Emitted any time the user id changes.
   */
  UserIdChange,

  // User Events
  NewUserEvent,
  UserLoginEvent,
  UserLogoutEvent,
  UserPropertiesEvent,

  // Events
  Event
}

export interface DbxAnalyticsStreamEvent {
  readonly type: DbxAnalyticsStreamEventType;
  readonly user?: Maybe<DbxAnalyticsUser>;
  readonly event?: DbxUserAnalyticsEvent;
  readonly userId?: DbxAnalyticsUserId;
}
