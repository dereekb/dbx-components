import { type Maybe } from '@dereekb/util';
import { fetchApiFetchService, fetchJsonFunction, returnNullHandleFetchJsonParseErrorFunction, type ConfiguredFetch, type FetchHandler } from '@dereekb/util/fetch';
import { MICROSOFT_OAUTH_TOKEN_CONTENT_TYPE } from './oauth.api';
import { assertMicrosoftSingleTenantId, type MicrosoftOAuthConfig, type MicrosoftOAuthContext, type MicrosoftOAuthContextRef, type MicrosoftOAuthFetchFactory, type MicrosoftOAuthFetchFactoryInput, microsoftOAuthTenantBaseUrl } from './oauth.config';
import { handleMicrosoftOAuthErrorFetch, type LogMicrosoftOAuthErrorFunction } from './oauth.error.api';

export type MicrosoftOAuth = MicrosoftOAuthContextRef;

export interface MicrosoftOAuthFactoryConfig {
  /**
   * Creates a new fetch instance to use when making calls.
   */
  readonly fetchFactory?: MicrosoftOAuthFetchFactory;
  /**
   * Custom FetchHandler to use with the default fetchFactory. The seam specs use to intercept requests; a
   * response it returns still goes through the timeout, the ok-check and the OAuth error mapping.
   */
  readonly fetchHandler?: Maybe<FetchHandler>;
  /**
   * Custom log error function.
   */
  readonly logMicrosoftOAuthErrorFunction?: LogMicrosoftOAuthErrorFunction;
}

export type MicrosoftOAuthFactory = (config: MicrosoftOAuthConfig) => MicrosoftOAuth;

/**
 * Creates a {@link MicrosoftOAuthFactory} that produces configured, single-tenant Microsoft OAuth
 * instances.
 *
 * The produced fetch is rooted at the tenant's `/oauth2/v2.0` base, so the token endpoint is a relative
 * path; Graph calls use absolute URLs and bypass it.
 *
 * @param factoryConfig - Optional fetch factory, fetch handler and error logging.
 * @returns A factory accepting a MicrosoftOAuthConfig and producing a MicrosoftOAuth instance.
 * @throws {Error} From the produced factory, when the client id or secret is missing or the tenant is a multi-tenant authority.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function microsoftOAuthFactory(factoryConfig: MicrosoftOAuthFactoryConfig = {}): MicrosoftOAuthFactory {
  const { fetchHandler, logMicrosoftOAuthErrorFunction } = factoryConfig;

  const {
    fetchFactory = (input: MicrosoftOAuthFetchFactoryInput) =>
      fetchApiFetchService.makeFetch({
        baseUrl: microsoftOAuthTenantBaseUrl(input.config.tenantId),
        baseRequest: {
          headers: {
            'Content-Type': MICROSOFT_OAUTH_TOKEN_CONTENT_TYPE
          }
        },
        // the handler stands in for the network UNDER the timeout and the ok-check, so a non-2xx answer it
        // returns is mapped exactly as a real one would be
        ...(fetchHandler ? { makeFetch: ((input: RequestInfo | URL, init?: RequestInit) => fetchHandler(new Request(input, init), fetch)) as typeof fetch } : undefined),
        timeout: 20 * 1000, // 20 second timeout
        requireOkResponse: true, // enforce ok response
        useTimeout: true // use timeout
      })
  } = factoryConfig;

  return (inputConfig: MicrosoftOAuthConfig) => {
    if (!inputConfig.clientId) {
      throw new Error('MicrosoftOAuthConfig missing clientId.');
    } else if (!inputConfig.clientSecret) {
      throw new Error('MicrosoftOAuthConfig missing clientSecret.');
    }

    const config: MicrosoftOAuthConfig = { ...inputConfig, tenantId: assertMicrosoftSingleTenantId(inputConfig.tenantId) };
    const baseFetch = fetchFactory({ config });

    const fetch: ConfiguredFetch = handleMicrosoftOAuthErrorFetch(baseFetch, logMicrosoftOAuthErrorFunction);
    const fetchJson = fetchJsonFunction(fetch, {
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    const oauthContext: MicrosoftOAuthContext = {
      fetch,
      fetchJson,
      config
    };

    return { oauthContext };
  };
}
