import { Maybe } from "@dereekb/util";
import { DbxAnalyticsUser, DbxUserAnalyticsEvent, DbxAnalyticsUserId } from "./analytics";

export enum DbxAnalyticsStreamEventType {

  PageView,
  UserChange,

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
