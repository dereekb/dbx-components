import { Maybe, PrimativeKey } from '@dereekb/util';

export type DbxAnalyticsEventName = string;
export type DbxAnalyticsUserId = string;

export interface DbxAnalyticsUserProperties {
  readonly [key: string]: PrimativeKey | boolean;
}

export interface DbxAnalyticsUser {
  readonly user: DbxAnalyticsUserId;
  readonly properties?: DbxAnalyticsUserProperties;
}

export interface DbxAnalyticsEventData {
  readonly [key: string]: PrimativeKey | boolean;
}

export interface DbxAnalyticsEvent {
  readonly name?: DbxAnalyticsEventName;
  readonly value?: number;
  readonly data?: DbxAnalyticsEventData;
}

export interface DbxUserAnalyticsEvent extends DbxAnalyticsEvent {
  readonly user?: Maybe<DbxAnalyticsUser>;
}

// MARK: New User
export type NewUserRegistrationMethod = 'facebook' | 'google' | 'email' | string;

export interface NewUserAnalyticsEventData extends DbxAnalyticsEventData {
  method: NewUserRegistrationMethod;
}
