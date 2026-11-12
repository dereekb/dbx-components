import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { fetchApiFetchService, fetchJsonFunction, returnNullHandleFetchJsonParseErrorFunction, type FetchHandler } from '@dereekb/util/fetch';
import { MICROSOFT_GRAPH_API_URL } from '../microsoft.config';
import { type MicrosoftGraphAccessTokenGetter, type MicrosoftGraphContextRef } from './graph.config';
import { handleMicrosoftGraphErrorFetch } from './graph.error.api';

export interface MicrosoftGraphFactoryConfig {
  /**
   * Custom FetchHandler. The seam specs use to intercept requests.
   */
  readonly fetchHandler?: Maybe<FetchHandler>;
  /**
   * Overrides the Graph base URL. Defaults to {@link MICROSOFT_GRAPH_API_URL}.
   */
  readonly apiUrl?: Maybe<WebsiteUrl>;
}

export interface MicrosoftGraphConfig {
  /**
   * Supplies the user's bearer token for each request.
   */
  readonly accessTokenGetter: MicrosoftGraphAccessTokenGetter;
}

export type MicrosoftGraph = MicrosoftGraphContextRef;

export type MicrosoftGraphFactory = (config: MicrosoftGraphConfig) => MicrosoftGraph;

/**
 * Creates a {@link MicrosoftGraphFactory} producing Graph clients that act as one user.
 *
 * @param factoryConfig - Optional fetch handler and base URL.
 * @returns A factory accepting the access token getter.
 *
 * @example
 * ```ts
 * const { graphContext } = microsoftGraphFactory()({ accessTokenGetter: () => token });
 * const me = await microsoftGraphRequest(graphContext)({ method: 'GET', path: '/me' });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function microsoftGraphFactory(factoryConfig: MicrosoftGraphFactoryConfig = {}): MicrosoftGraphFactory {
  const { fetchHandler, apiUrl } = factoryConfig;

  const baseFetch = fetchApiFetchService.makeFetch({
    baseUrl: apiUrl ?? MICROSOFT_GRAPH_API_URL,
    // Graph rejects a JSON body sent as text/plain ("Entity only allows writes with a JSON Content-Type
    // header"), and fetchJson stringifies the body without setting the header. A raw request with a
    // non-JSON body overrides it (see microsoftGraphRequestRaw).
    baseRequest: { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } },
    // the handler stands in for the network UNDER the timeout and the ok-check, so a non-2xx answer it
    // returns is mapped exactly as a real one would be
    ...(fetchHandler ? { makeFetch: ((input: RequestInfo | URL, init?: RequestInit) => fetchHandler(new Request(input, init), fetch)) as typeof fetch } : undefined),
    timeout: 30 * 1000, // 30 second timeout
    requireOkResponse: true,
    useTimeout: true
  });

  const fetch = handleMicrosoftGraphErrorFetch(baseFetch);
  const fetchJson = fetchJsonFunction(fetch, {
    handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
  });

  return (config: MicrosoftGraphConfig) => ({
    graphContext: {
      fetch,
      fetchJson,
      accessTokenGetter: config.accessTokenGetter
    }
  });
}
