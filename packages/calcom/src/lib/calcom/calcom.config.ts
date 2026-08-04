import { type FactoryWithRequiredInput } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type CalcomConfig } from '../calcom.config';
import { type CalcomAccessTokenStringFactory } from '../oauth/oauth';
import { type CalcomRefreshTokenCredential } from '../oauth/oauth.config';
import { type CalcomRateLimiterRef } from '../calcom.limit';

export interface CalcomFetchFactoryInput {
  readonly calcomAccessTokenStringFactory: CalcomAccessTokenStringFactory;
}

export type CalcomFetchFactory = (input: CalcomFetchFactoryInput) => ConfiguredFetch;

/**
 * A calcom context that can send requests to the Cal.com API.
 */
export interface CalcomContext extends CalcomRateLimiterRef {
  /**
   * Type of context this is.
   */
  readonly type: 'server' | 'user';
  /**
   * Performs a fetch.
   */
  readonly fetch: ConfiguredFetch;
  /**
   * Performs a json fetch.
   */
  readonly fetchJson: FetchJsonFunction;
}

export interface CalcomUserContext extends CalcomContext {
  readonly type: 'user';
  readonly calcomServerContext: CalcomServerContext;
  readonly userFetch: ConfiguredFetch;
  readonly userFetchJson: FetchJsonFunction;
}

/**
 * Creates a CalcomUserContext from a user's credential.
 *
 * Deliberately the refresh-token arm of {@link CalcomAuthCredential} rather than the full union: a
 * user context acts as a connected user, while an api key acts as whoever created it — which is the
 * server context's job.
 */
export type CalcomUserContextFactory = FactoryWithRequiredInput<CalcomUserContext, CalcomRefreshTokenCredential>;

/**
 * Context for making public (unauthenticated) requests to the Cal.com API.
 */
export interface CalcomPublicContext {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
}

export interface CalcomServerContext extends CalcomContext {
  readonly type: 'server';
  readonly serverFetch: ConfiguredFetch;
  readonly serverFetchJson: FetchJsonFunction;
  readonly makeUserContext: CalcomUserContextFactory;
  readonly makePublicContext: () => CalcomPublicContext;
  readonly config: CalcomConfig;
}

export interface CalcomServerContextRef {
  readonly calcomServerContext: CalcomServerContext;
}
