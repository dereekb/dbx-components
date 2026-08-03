import { type Maybe } from '@dereekb/util';
import { fetchApiFetchService, fetchJsonFunction, returnNullHandleFetchJsonParseErrorFunction, type ConfiguredFetch, type FetchHandler } from '@dereekb/util/fetch';
import { DISCORD_API_URL } from '../discord.config';
import { discordOAuthBasicAuthorizationHeader, DISCORD_OAUTH_TOKEN_CONTENT_TYPE } from './oauth.api';
import { type DiscordOAuthConfig, type DiscordOAuthContext, type DiscordOAuthContextRef, type DiscordOAuthFetchFactory, type DiscordOAuthFetchFactoryInput } from './oauth.config';
import { handleDiscordOAuthErrorFetch, type LogDiscordOAuthErrorFunction } from './oauth.error.api';

export type DiscordOAuth = DiscordOAuthContextRef;

export interface DiscordOAuthFactoryConfig {
  /**
   * Creates a new fetch instance to use when making calls.
   */
  readonly fetchFactory?: DiscordOAuthFetchFactory;
  /**
   * Custom FetchHandler to use with the default fetchFactory.
   *
   * This is the seam specs use to intercept requests before they leave the process. Ignored when a
   * `fetchFactory` is provided.
   */
  readonly fetchHandler?: Maybe<FetchHandler>;
  /**
   * Custom log error function.
   */
  readonly logDiscordOAuthErrorFunction?: LogDiscordOAuthErrorFunction;
}

export type DiscordOAuthFactory = (config: DiscordOAuthConfig) => DiscordOAuth;

/**
 * Creates a {@link DiscordOAuthFactory} that produces configured Discord OAuth instances.
 *
 * There is no access-token cache or per-user token factory here, unlike `calcomOAuthFactory`: the
 * external-connection framework stores each user's credentials itself, so the client only ever needs
 * to make the calls it is asked to make.
 *
 * @param factoryConfig - Configuration including an optional fetch factory, fetch handler, and error logging.
 * @returns A factory accepting a DiscordOAuthConfig and producing a DiscordOAuth instance.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function discordOAuthFactory(factoryConfig: DiscordOAuthFactoryConfig): DiscordOAuthFactory {
  const { fetchHandler, logDiscordOAuthErrorFunction } = factoryConfig;

  const {
    fetchFactory = (input: DiscordOAuthFetchFactoryInput) =>
      fetchApiFetchService.makeFetch({
        baseUrl: DISCORD_API_URL,
        baseRequest: {
          headers: {
            // the token endpoint's shape, since it is the only endpoint that posts a body. A
            // per-request header of the same name wins, which is how readCurrentUser swaps the
            // client's Basic credentials for the user's Bearer token.
            'Content-Type': DISCORD_OAUTH_TOKEN_CONTENT_TYPE,
            Authorization: discordOAuthBasicAuthorizationHeader(input.config)
          }
        },
        fetchHandler: fetchHandler ?? undefined,
        timeout: 20 * 1000, // 20 second timeout
        requireOkResponse: true, // enforce ok response
        useTimeout: true // use timeout
      })
  } = factoryConfig;

  return (config: DiscordOAuthConfig) => {
    // a missing credential otherwise composes `client_id=undefined` on the authorize URL and fails at
    // the consent screen rather than at startup
    if (!config.clientId) {
      throw new Error('DiscordOAuthConfig missing clientId.');
    } else if (!config.clientSecret) {
      throw new Error('DiscordOAuthConfig missing clientSecret.');
    }

    const baseFetch = fetchFactory({ config });

    const fetch: ConfiguredFetch = handleDiscordOAuthErrorFetch(baseFetch, logDiscordOAuthErrorFunction);
    const fetchJson = fetchJsonFunction(fetch, {
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    const oauthContext: DiscordOAuthContext = {
      fetch,
      fetchJson,
      config
    };

    const discordOAuth: DiscordOAuth = {
      oauthContext
    };

    return discordOAuth;
  };
}
