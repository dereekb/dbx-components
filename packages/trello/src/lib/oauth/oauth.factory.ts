import { type Maybe } from '@dereekb/util';
import { fetchApiFetchService, fetchJsonFunction, returnNullHandleFetchJsonParseErrorFunction, type ConfiguredFetch, type FetchHandler } from '@dereekb/util/fetch';
import { type TrelloOAuthConfig, type TrelloOAuthContext, type TrelloOAuthContextRef } from './oauth.config';
import { handleTrelloOAuthErrorFetch, type LogTrelloOAuthErrorFunction } from './oauth.error.api';

export type TrelloOAuth = TrelloOAuthContextRef;

export interface TrelloOAuthFactoryConfig {
  /**
   * Custom FetchHandler, standing in for the network call.
   *
   * This is the seam specs use to intercept requests before they leave the process. It sees BOTH hosts:
   * `auth.atlassian.com` for the token calls and the Trello REST base for the member read. A response it
   * returns still goes through the timeout, the ok-check and the OAuth error mapping. Its `makeFetch`
   * argument is the global fetch.
   */
  readonly fetchHandler?: Maybe<FetchHandler>;
  /**
   * Custom log error function.
   */
  readonly logTrelloOAuthErrorFunction?: LogTrelloOAuthErrorFunction;
}

export type TrelloOAuthFactory = (config: TrelloOAuthConfig) => TrelloOAuth;

/**
 * Creates a {@link TrelloOAuthFactory} that produces configured Trello OAuth 2.0 clients.
 *
 * There is no access-token cache or per-user token factory here: the external-connection framework
 * stores each member's credentials itself, so the client only makes the calls it is asked to make.
 *
 * @param factoryConfig - Configuration including an optional fetch handler and error logging.
 * @returns A factory accepting a TrelloOAuthConfig and producing a TrelloOAuth instance.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function trelloOAuthFactory(factoryConfig: TrelloOAuthFactoryConfig = {}): TrelloOAuthFactory {
  const { fetchHandler, logTrelloOAuthErrorFunction } = factoryConfig;

  return (config: TrelloOAuthConfig) => {
    // a missing credential otherwise composes `client_id=undefined` on the authorize URL and fails at
    // the consent screen rather than at startup
    if (!config.clientId) {
      throw new Error('TrelloOAuthConfig missing clientId.');
    } else if (!config.clientSecret) {
      throw new Error('TrelloOAuthConfig missing clientSecret.');
    }

    // no base URL: the token calls and the member read go to different hosts, so each passes a full URL
    const baseFetch = fetchApiFetchService.makeFetch({
      baseRequest: {
        headers: {
          'Content-Type': 'application/json'
        }
      },
      ...(fetchHandler ? { makeFetch: ((input: RequestInfo | URL, init?: RequestInit) => fetchHandler(new Request(input, init), fetch)) as typeof fetch } : undefined),
      timeout: 20 * 1000, // 20 second timeout
      requireOkResponse: true, // enforce ok response
      useTimeout: true // use timeout
    });

    const fetch: ConfiguredFetch = handleTrelloOAuthErrorFetch(baseFetch, logTrelloOAuthErrorFunction);
    const fetchJson = fetchJsonFunction(fetch, {
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    const oauthContext: TrelloOAuthContext = {
      fetch,
      fetchJson,
      config
    };

    return { oauthContext };
  };
}
