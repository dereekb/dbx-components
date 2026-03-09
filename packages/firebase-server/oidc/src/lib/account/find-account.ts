import type * as admin from 'firebase-admin';

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

// MARK: Scope helpers
function buildClaimsFromUser(user: admin.auth.UserRecord, scope: string): OidcAccountClaims {
  const scopes = new Set(scope.split(' '));
  const claims: OidcAccountClaims = { sub: user.uid };

  if (scopes.has('profile')) {
    if (user.displayName) {
      claims.name = user.displayName;
    }

    if (user.photoURL) {
      claims.picture = user.photoURL;
    }
  }

  if (scopes.has('email')) {
    if (user.email) {
      claims.email = user.email;
      claims.email_verified = user.emailVerified ?? false;
    }
  }

  return claims;
}

// MARK: Factory
/**
 * Creates a findAccount function backed by Firebase Admin Auth.
 *
 * @param auth Firebase Admin Auth instance
 * @returns findAccount function compatible with oidc-provider
 */
export function createFindAccount(auth: admin.auth.Auth): FindAccountFunction {
  return async (_ctx: unknown, id: string): Promise<OidcAccount | undefined> => {
    try {
      const user = await auth.getUser(id);

      return {
        accountId: user.uid,
        async claims(_use: string, scope: string): Promise<OidcAccountClaims> {
          return buildClaimsFromUser(user, scope);
        }
      };
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        return undefined;
      }

      throw err;
    }
  };
}
