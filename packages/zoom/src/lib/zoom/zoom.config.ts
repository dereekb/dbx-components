import { type FactoryWithInput, type FactoryWithRequiredInput } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type ZoomConfig } from '../zoom.config';
import { type ZoomRateLimiterRef } from '../zoom.limit';
import { type ZoomAccessTokenStringFactory } from '../oauth/oauth';
import { type ZoomRefreshTokenCredential } from '../oauth/oauth.config';

export interface ZoomFetchFactoryParams {
  readonly zoomAccessTokenStringFactory: ZoomAccessTokenStringFactory;
}

export type ZoomFetchFactory = FactoryWithInput<ConfiguredFetch, ZoomFetchFactoryParams>;

/**
 * Denotes the type of authorization used by the ZoomContext.
 *
 * - 'server': Uses Server to Server authorization
 * - 'user': Uses User to Server authorization
 */
export type ZoomContextType = 'server' | 'user';

/**
 * A zoom context that can send requests to the Zoom API.
 */
export interface ZoomContext extends ZoomRateLimiterRef {
  /**
   * Type of context this is.
   */
  readonly type: ZoomContextType;
  /**
   * Performs a fetch as the server.
   */
  readonly fetch: ConfiguredFetch;
  /**
   * Performs a json fetch as the server.
   */
  readonly fetchJson: FetchJsonFunction;
}

export interface ZoomServerContext extends ZoomContext {
  readonly type: 'server';
  readonly serverFetch: ConfiguredFetch;
  readonly serverFetchJson: FetchJsonFunction;
  readonly makeUserContext: ZoomUserContextFactory;
  readonly config: ZoomConfig;
}

/**
 * Creates a ZoomUserContext from a user's credential.
 *
 * Deliberately the refresh-token arm of {@link ZoomAuthCredential} rather than the full union: a
 * user context acts as a connected user, while the account credential is the app's own identity —
 * which is the server context's job.
 */
export type ZoomUserContextFactory = FactoryWithRequiredInput<ZoomUserContext, ZoomRefreshTokenCredential>;

/**
 * Context used for performing fetch requests for a specific user.
 */
export interface ZoomUserContext extends ZoomContext {
  readonly type: 'user';
  readonly zoomServerContext: ZoomServerContext;
  readonly userFetch: ConfiguredFetch;
  readonly userFetchJson: FetchJsonFunction;
}

export interface ZoomServerContextRef {
  readonly zoomServerContext: ZoomServerContext;
}
