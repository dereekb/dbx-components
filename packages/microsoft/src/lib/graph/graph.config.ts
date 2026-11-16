import { type PromiseOrValue } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';

/**
 * Returns the bearer access token for the next Graph request. Called once per request, so a getter
 * backed by a refreshing cache (a token source, the external-connection reader) stays current.
 */
export type MicrosoftGraphAccessTokenGetter = () => PromiseOrValue<string>;

/**
 * Context used for performing Graph calls.
 */
export interface MicrosoftGraphContext {
  /**
   * The configured fetch under {@link MicrosoftGraphContext.fetchJson}: Graph base URL, timeout, non-2xx
   * mapped to a `MicrosoftGraphError`. Used by the raw request path, which must not JSON-parse.
   */
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly accessTokenGetter: MicrosoftGraphAccessTokenGetter;
}

export interface MicrosoftGraphContextRef {
  readonly graphContext: MicrosoftGraphContext;
}
