import { Maybe, PrimativeKey } from "@dereekb/util";

export type AnalyticsEventName = string;
export type AnalyticsUserId = string;

export interface AnalyticsUser {
  readonly user: AnalyticsUserId;
  readonly properties?: {
    readonly [key: string]: PrimativeKey | boolean;
  };
}

export interface AnalyticsEventData {
  readonly [key: string]: PrimativeKey | boolean;
}

export type NewUserRegistrationMethod = 'facebook' | 'google' | 'email' | string;

export interface NewUserAnalyticsEventData extends AnalyticsEventData {
  method: NewUserRegistrationMethod;
}

export interface AnalyticsEvent {
  readonly name?: AnalyticsEventName;
  readonly value?: number;
  readonly data?: AnalyticsEventData;
}

export interface UserAnalyticsEvent extends AnalyticsEvent {
  readonly user?: Maybe<AnalyticsUser>;
}
