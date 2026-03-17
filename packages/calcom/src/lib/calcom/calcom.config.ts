import { type FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type CalcomConfig, type CalcomRefreshToken } from '../calcom.config';
import { type CalcomAccessTokenCache, type CalcomAccessTokenStringFactory } from '../oauth/oauth';
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

export interface CalcomUserContextFactoryInput {
  /**
   * The user's refresh token.
   */
  readonly refreshToken: CalcomRefreshToken;
  /**
   * Optional cache to use for the user's access token.
   *
   * The cache should only be configured for the user that owns the refresh token.
   */
  readonly accessTokenCache?: Maybe<CalcomAccessTokenCache>;
}

/**
 * Creates a CalcomUserContext from the input.
 */
export type CalcomUserContextFactory = FactoryWithRequiredInput<CalcomUserContext, CalcomUserContextFactoryInput>;

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
