import { Maybe } from "@dereekb/util";
import { AnalyticsUser, UserAnalyticsEvent, AnalyticsUserId } from "./analytics";

export enum AnalyticsStreamEventType {

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

export interface AnalyticsStreamEvent {
  readonly type: AnalyticsStreamEventType;
  readonly user?: Maybe<AnalyticsUser>;
  readonly event?: UserAnalyticsEvent;
  readonly userId?: AnalyticsUserId;
}
