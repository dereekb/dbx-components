import { fetchJsonFunction, fetchApiFetchService, type ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { type CalcomServerContext, type CalcomServerContextRef, type CalcomFetchFactory, type CalcomFetchFactoryInput, type CalcomUserContext, type CalcomUserContextFactory, type CalcomUserContextFactoryInput, type CalcomPublicContext } from './calcom.config';
import { type LogCalcomServerErrorFunction } from '../calcom.error.api';
import { handleCalcomErrorFetch } from './calcom.error.api';
import { type CalcomOAuthContextRef } from '../oauth/oauth.config';
import { calcomAccessTokenStringFactory } from '../oauth/oauth';
import { type CalcomRateLimitedFetchHandlerConfig, calcomRateLimitedFetchHandler } from '../calcom.limit';
import { type Maybe } from '@dereekb/util';
import { CALCOM_API_URL, type CalcomConfig } from '../calcom.config';

export type Calcom = CalcomServerContextRef;

export interface CalcomFactoryConfig extends CalcomOAuthContextRef {
  /**
   * Custom CalcomRateLimitedFetchHandlerConfig
   */
  readonly rateLimiterConfig?: Maybe<CalcomRateLimitedFetchHandlerConfig>;
  /**
   * Creates a new fetch instance to use when making calls.
   */
  readonly fetchFactory?: CalcomFetchFactory;
  /**
   * Custom log error function.
   */
  readonly logCalcomServerErrorFunction?: LogCalcomServerErrorFunction;
}

export type CalcomFactory = (config: CalcomConfig) => Calcom;

/**
 * Creates a {@link CalcomFactory} that produces fully configured Cal.com API instances.
 * Sets up rate limiting, error handling, OAuth token management, and both server
 * and per-user fetch contexts.
 *
 * @param factoryConfig - configuration including OAuth context, rate limiter, and optional fetch/logging overrides
 * @returns a factory function that accepts a CalcomConfig and produces a Calcom instance
 */
export function calcomFactory(factoryConfig: CalcomFactoryConfig): CalcomFactory {
  const { oauthContext } = factoryConfig;
  const serverAccessTokenStringFactory = calcomAccessTokenStringFactory(oauthContext.loadAccessToken);
  const fetchHandler = calcomRateLimitedFetchHandler(factoryConfig.rateLimiterConfig);

  const {
    logCalcomServerErrorFunction,
    fetchFactory = (input: CalcomFetchFactoryInput) =>
      fetchApiFetchService.makeFetch({
        baseUrl: CALCOM_API_URL,
        baseRequest: async () => ({
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await input.calcomAccessTokenStringFactory()}`
          }
        }),
        fetchHandler,
        timeout: 20 * 1000, // 20 second timeout
        requireOkResponse: true, // enforce ok response
        useTimeout: true // use timeout
      })
  } = factoryConfig;

  return (config: CalcomConfig) => {
    const baseFetch = fetchFactory({
      calcomAccessTokenStringFactory: serverAccessTokenStringFactory
    });

    const serverFetch: ConfiguredFetch = handleCalcomErrorFetch(baseFetch, logCalcomServerErrorFunction);
    const serverFetchJson = fetchJsonFunction(serverFetch, {
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    // MARK: Make Public Context
    const makePublicContext = (): CalcomPublicContext => {
      const publicFetch = fetchApiFetchService.makeFetch({
        baseUrl: CALCOM_API_URL,
        baseRequest: {
          headers: {
            'Content-Type': 'application/json'
          }
        },
        fetchHandler,
        timeout: 20 * 1000,
        requireOkResponse: true,
        useTimeout: true
      });

      const publicHandledFetch: ConfiguredFetch = handleCalcomErrorFetch(publicFetch, logCalcomServerErrorFunction);
      const publicFetchJson = fetchJsonFunction(publicHandledFetch, {
        handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
      });

      return {
        fetch: publicHandledFetch,
        fetchJson: publicFetchJson
      };
    };

    // MARK: Make User Context
    const makeUserContext: CalcomUserContextFactory = (input: CalcomUserContextFactoryInput) => {
      const userAccessTokenFactory = oauthContext.makeUserAccessTokenFactory({
        refreshToken: input.refreshToken,
        userAccessTokenCache: input.accessTokenCache
      });

      const userAccessTokenStringFactory = calcomAccessTokenStringFactory(userAccessTokenFactory);

      const userBaseFetch = fetchFactory({
        calcomAccessTokenStringFactory: userAccessTokenStringFactory
      });

      const userFetch: ConfiguredFetch = handleCalcomErrorFetch(userBaseFetch, logCalcomServerErrorFunction);
      const userFetchJson = fetchJsonFunction(userFetch, {
        handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
      });

      const result: CalcomUserContext = {
        calcomServerContext: calcomContext,
        type: 'user',
        fetch: userFetch,
        fetchJson: userFetchJson,
        userFetch,
        userFetchJson,
        calcomRateLimiter: fetchHandler._rateLimiter
      };

      return result;
    };

    const calcomContext: CalcomServerContext = {
      type: 'server',
      fetch: serverFetch,
      fetchJson: serverFetchJson,
      serverFetch,
      serverFetchJson,
      makeUserContext,
      makePublicContext,
      config,
      calcomRateLimiter: fetchHandler._rateLimiter
    };

    const calcom: Calcom = {
      calcomServerContext: calcomContext
    };

    return calcom;
  };
}
