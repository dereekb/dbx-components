import { type Maybe } from '@dereekb/util';
import { type OAuthResourceErrorCode } from '../error/oauth.resource.error';

// MARK: Types
/**
 * The RFC 6750 §3 `error` codes a resource server emits on a `WWW-Authenticate: Bearer` challenge.
 */
export type BearerChallengeErrorCode = 'invalid_request' | 'invalid_token' | 'insufficient_scope';

export interface BuildBearerChallengeConfig {
  /**
   * The RFC 6750 `error` token. Any string is accepted so a consumer can emit a code this union
   * does not enumerate.
   */
  readonly error: BearerChallengeErrorCode | string;
  /**
   * Protection space name. Omitted by default — a resource server that serves exactly one
   * protection space does not need it.
   */
  readonly realm?: Maybe<string>;
  /**
   * Absolute URL of the RFC 9728 protected-resource metadata document, so a client can discover
   * the authorization server from the challenge alone rather than relying on origin-rooted
   * path-walkback (which 404s whenever the resource is not mounted at the origin root).
   */
  readonly resourceMetadataUrl?: Maybe<string>;
  /**
   * Human-readable explanation (`error_description`).
   */
  readonly errorDescription?: Maybe<string>;
  /**
   * Space-delimited scopes required for the request, meaningful with `insufficient_scope`.
   */
  readonly scope?: Maybe<string>;
}

export interface BearerChallengeErrorCodeConfig {
  /**
   * The failure's code.
   */
  readonly code: OAuthResourceErrorCode;
  /**
   * Whether the request presented a bearer token at all.
   */
  readonly hadToken: boolean;
}

// MARK: Challenge
/**
 * Builds the `WWW-Authenticate: Bearer ...` challenge string emitted alongside a 401 / 403 on an
 * OAuth-protected route.
 *
 * Per RFC 6750 §3 / RFC 7235, auth-params are comma-separated. Parameter order is not significant
 * to a client; this emits `realm`, `resource_metadata`, `error`, `error_description`, `scope`.
 *
 * @param config - The error token plus the optional realm / metadata / description / scope params.
 * @returns The header value, e.g. `Bearer resource_metadata="…", error="invalid_token"`.
 */
export function buildBearerChallenge(config: BuildBearerChallengeConfig): string {
  const params: string[] = [];

  if (config.realm) {
    params.push(`realm="${config.realm}"`);
  }

  if (config.resourceMetadataUrl) {
    params.push(`resource_metadata="${config.resourceMetadataUrl}"`);
  }

  params.push(`error="${config.error}"`);

  if (config.errorDescription) {
    params.push(`error_description="${config.errorDescription}"`);
  }

  if (config.scope) {
    params.push(`scope="${config.scope}"`);
  }

  return `Bearer ${params.join(', ')}`;
}

/**
 * Selects the RFC 6750 §3 `error` token for a failure: `insufficient_scope` for a policy (403)
 * failure, `invalid_token` when a token was presented but failed, and `invalid_request` when the
 * request carried no token at all.
 *
 * @param config - The failure code and whether a token was presented.
 * @returns The RFC 6750 error token.
 */
export function bearerChallengeErrorForCode(config: BearerChallengeErrorCodeConfig): BearerChallengeErrorCode {
  let result: BearerChallengeErrorCode;

  if (config.code === 'forbidden') {
    result = 'insufficient_scope';
  } else if (config.hadToken) {
    result = 'invalid_token';
  } else {
    result = 'invalid_request';
  }

  return result;
}

// MARK: Header
/**
 * The `Authorization` header scheme prefix a bearer token is presented with.
 */
export const BEARER_AUTHORIZATION_PREFIX = 'Bearer ';

/**
 * Reads the raw bearer token out of an `Authorization` header value.
 *
 * @param header - The raw `Authorization` header value, if any.
 * @returns The token, or `undefined` when the header is absent, uses another scheme, or is empty.
 */
export function readBearerToken(header: Maybe<string>): string | undefined {
  let token: string | undefined;

  if (header?.startsWith(BEARER_AUTHORIZATION_PREFIX)) {
    const raw = header.slice(BEARER_AUTHORIZATION_PREFIX.length).trim();
    token = raw.length > 0 ? raw : undefined;
  }

  return token;
}
