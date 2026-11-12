import { type PromiseOrValue } from '@dereekb/util';
import { type FetchJsonFunction } from '@dereekb/util/fetch';

/**
 * Returns the bearer access token for the next Graph request. Called once per request, so a getter
 * backed by a refreshing cache (a token source, the external-connection reader) stays current.
 */
export type MicrosoftGraphAccessTokenGetter = () => PromiseOrValue<string>;

/**
 * Context used for performing Graph calls.
 */
export interface MicrosoftGraphContext {
  readonly fetchJson: FetchJsonFunction;
  readonly accessTokenGetter: MicrosoftGraphAccessTokenGetter;
}

export interface MicrosoftGraphContextRef {
  readonly graphContext: MicrosoftGraphContext;
}
