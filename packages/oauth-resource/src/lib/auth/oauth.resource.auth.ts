import { type UnixDateTimeSecondsNumber } from '@dereekb/util';
import { type VerifiedBearer } from '../verify/verify.bearer';

// MARK: Auth Info
/**
 * The verified caller attached to a request by a resource server's bearer middleware.
 *
 * Structurally identical to the MCP TypeScript SDK's `AuthInfo` (`@modelcontextprotocol/server`),
 * so an MCP host can assign one to `req.auth` and the SDK's `toNodeHandler` forwards it to the
 * handler as `authInfo` with no cast. The type is declared locally on purpose: taking an
 * SDK peer dependency just to borrow a five-field interface would pull the whole MCP install
 * graph into a service that only needs to check a signature.
 */
export interface OAuthResourceAuthInfo {
  /**
   * The raw bearer token as presented.
   */
  readonly token: string;
  /**
   * The OAuth client the token was issued to (`client_id`), or a stand-in when the token carries
   * no client (see {@link oauthResourceAuthInfoForVerifiedBearer}).
   */
  readonly clientId: string;
  /**
   * Scopes granted on the token, split out of the space-delimited `scope` claim.
   */
  readonly scopes: string[];
  /**
   * Token expiry, as unix epoch seconds (the `exp` claim).
   */
  readonly expiresAt?: UnixDateTimeSecondsNumber;
  /**
   * Anything else the resource server wants to carry through to its handlers.
   */
  readonly extra?: Record<string, unknown>;
}

// MARK: Conversion
/**
 * Fallback `clientId` used for a verified Firebase ID token, which names no OAuth client.
 */
export const FIREBASE_AUTH_INFO_CLIENT_ID = 'firebase';

/**
 * Splits a space-delimited OAuth `scope` claim into its entries.
 *
 * @param scope - The raw `scope` claim value, if any.
 * @returns The scope entries, empty when the claim is absent or not a string.
 */
export function scopesFromScopeClaim(scope: unknown): string[] {
  return typeof scope === 'string' ? scope.split(' ').filter((entry) => entry.length > 0) : [];
}

/**
 * Converts a {@link VerifiedBearer} into the {@link OAuthResourceAuthInfo} attached to the request.
 *
 * A token with no `client_id` claim is not from an OAuth client: a Firebase ID token reports
 * {@link FIREBASE_AUTH_INFO_CLIENT_ID}, and any other issuer falls back to the subject.
 *
 * @param verified - The verified bearer token.
 * @returns The auth info.
 */
export function oauthResourceAuthInfoForVerifiedBearer(verified: VerifiedBearer): OAuthResourceAuthInfo {
  const claimClientId = verified.claims['client_id'];
  const fallbackClientId = verified.kind === 'firebase' ? FIREBASE_AUTH_INFO_CLIENT_ID : verified.subject;

  return {
    token: verified.token,
    clientId: typeof claimClientId === 'string' ? claimClientId : fallbackClientId,
    scopes: scopesFromScopeClaim(verified.claims['scope']),
    expiresAt: verified.claims.exp,
    extra: { sub: verified.subject, iss: verified.issuer, kind: verified.kind }
  };
}
