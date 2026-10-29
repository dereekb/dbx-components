import { type TrelloAccessTokenProvider, type TrelloBearerAccessToken } from '@dereekb/trello';
import { type UserExternalConnectionReaderProviderInstance } from '@dereekb/firebase-server/model';
import { safeToJsDate } from '@dereekb/date';
import { type Maybe, type Milliseconds } from '@dereekb/util';

/**
 * Configuration for {@link userExternalConnectionTrelloAccessTokenProvider}.
 */
export interface UserExternalConnectionTrelloAccessTokenProviderConfig {
  /**
   * The reader narrowed to the user and the Trello provider type to act as.
   */
  readonly reader: UserExternalConnectionReaderProviderInstance;
  /**
   * How long a handed-out token must still be valid for. See `readUsableUserExternalConnectionCredentials`.
   */
  readonly minimumRemaining?: Maybe<Milliseconds>;
}

/**
 * Bridges a user's stored Trello connection to `@dereekb/trello`'s bearer mode, server-side.
 *
 * The Trello analog of `userExternalConnectionZohoAccessTokenCache`: pass the result as
 * `trelloFactory()({ accessTokenProvider })` to act as the connected member.
 *
 * - The token comes from `readUsableUserExternalConnectionCredentials`, which refreshes under the
 *   cross-instance lease when it nears expiry.
 * - `resetAccessToken` — awaited by the bearer client after a 401 — reports the connection as
 *   `unauthorized`, so the next read refreshes and the client's single retry gets a fresh token.
 *
 * @param config - The narrowed reader and the optional minimum remaining validity.
 * @returns The access token provider.
 */
export function userExternalConnectionTrelloAccessTokenProvider(config: UserExternalConnectionTrelloAccessTokenProviderConfig): TrelloAccessTokenProvider {
  const { reader, minimumRemaining } = config;

  const provider = async (): Promise<TrelloBearerAccessToken> => {
    const credentials = await reader.readUsableUserExternalConnectionCredentials({ minimumRemaining });
    return { accessToken: credentials.accessToken, expiresAt: safeToJsDate(credentials.expiresAt) };
  };

  return Object.assign(provider, {
    resetAccessToken: () => reader.reportUserExternalConnectionFailure({ error: 'unauthorized' })
  });
}
