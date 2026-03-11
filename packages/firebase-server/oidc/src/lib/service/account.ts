// MARK: Types
/**
 * Account representation returned by the `findAccount` callback in oidc-provider.
 *
 * The provider calls {@link OidcAccount.claims} during token issuance and userinfo
 * responses to resolve the claims for the authenticated subject.
 *
 * @see {@link FindAccountFunction}
 * @see {@link OidcAccountServiceUserContext.findAccount}
 */
export interface OidcAccount {
  readonly accountId: string;
  claims(use: string, scope: string, claims?: Record<string, unknown>, rejected?: string[]): Promise<OidcAccountClaims>;
}

/**
 * Claims returned by the OIDC userinfo and ID token endpoints.
 *
 * Standard OIDC claims (`sub`, `email`, `name`, etc.) plus arbitrary custom claims
 * via the index signature.
 */
export interface OidcAccountClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

/**
 * Signature of the `findAccount` callback passed to the oidc-provider `Configuration`.
 *
 * The provider calls this during token and userinfo requests to resolve the
 * {@link OidcAccount} for a given subject identifier.
 *
 * @see {@link OidcService}
 */
export type FindAccountFunction = (ctx: unknown, id: string, token?: unknown) => Promise<OidcAccount | undefined>;
