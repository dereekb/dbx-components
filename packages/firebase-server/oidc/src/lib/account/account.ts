// MARK: Types
/**
 * oidc-provider Account interface.
 */
export interface OidcAccount {
  readonly accountId: string;
  claims(use: string, scope: string, claims?: Record<string, unknown>, rejected?: string[]): Promise<OidcAccountClaims>;
}

export interface OidcAccountClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

/**
 * oidc-provider findAccount function signature.
 */
export type FindAccountFunction = (ctx: unknown, id: string, token?: unknown) => Promise<OidcAccount | undefined>;
