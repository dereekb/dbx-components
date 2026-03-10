import { FirebaseServerAuthService, type FirebaseServerAuthUserContext } from '@dereekb/firebase-server';
import type { OidcAccount, OidcAccountClaims } from './account';
import { InjectionToken, Provider } from '@nestjs/common';

// MARK: Delegate
/**
 * Delegate interface that allows customizing how OIDC claims are built from a user context.
 *
 * Provide an implementation to add custom claims based on the requested scopes.
 *
 * @example
 * ```typescript
 * export class MyOidcAccountServiceDelegate extends OidcAccountServiceDelegate {
 *   async buildClaimsForUser(userContext: FirebaseServerAuthUserContext, scopes: Set<string>): Promise<OidcAccountClaims> {
 *     const user = await userContext.loadRecord();
 *     const claims: OidcAccountClaims = { sub: user.uid };
 *
 *     if (scopes.has('profile')) {
 *       if (user.displayName) {
 *         claims.name = user.displayName;
 *       }
 *
 *       if (user.photoURL) {
 *         claims.picture = user.photoURL;
 *       }
 *     }
 *
 *     if (scopes.has('email')) {
 *       if (user.email) {
 *         claims.email = user.email;
 *         claims.email_verified = user.emailVerified ?? false;
 *       }
 *     }
 *
 *     return claims;
 *   }
 * }
 * ```
 */
export abstract class OidcAccountServiceDelegate<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> {
  /**
   * Builds claims for the given user context based on the requested scopes.
   *
   * @param userContext - The Firebase Auth user context.
   * @param scopes - The set of requested OIDC scopes.
   * @returns The claims to return for this user.
   */
  abstract buildClaimsForUser(userContext: U, scopes: Set<string>): Promise<OidcAccountClaims> | OidcAccountClaims;
}

// MARK: User Context
/**
 * Per-user context for OIDC account operations.
 *
 * Created by {@link OidcAccountService.userContext} for a specific user ID.
 */
export class OidcAccountServiceUserContext<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> {
  readonly authUserContext: U;

  constructor(
    private readonly _service: OidcAccountService<U>,
    private readonly _uid: string
  ) {
    this.authUserContext = this._service.authService.userContext(this._uid) as U;
  }

  get uid(): string {
    return this._uid;
  }

  get service(): OidcAccountService<U> {
    return this._service;
  }

  /**
   * Finds this user's OIDC account representation.
   *
   * Returns an {@link OidcAccount} compatible with oidc-provider's `findAccount` interface,
   * or `undefined` if the user does not exist in Firebase Auth.
   */
  async findAccount(): Promise<OidcAccount | undefined> {
    const authUserContext = this.authUserContext;
    const exists = await authUserContext.exists();

    if (!exists) {
      return undefined;
    }

    const delegate = this._service.delegate;

    return {
      accountId: this._uid,
      async claims(_use: string, scope: string): Promise<OidcAccountClaims> {
        const scopes = new Set(scope.split(' '));
        return delegate.buildClaimsForUser(authUserContext, scopes);
      }
    };
  }
}

// MARK: Service
/**
 * Injection token for the {@link OidcAccountService} instance.
 */
export const OIDC_ACCOUNT_SERVICE_TOKEN: InjectionToken = 'OIDC_ACCOUNT_SERVICE_TOKEN';

/**
 * Service that provides OIDC account lookup backed by Firebase Auth.
 *
 * Uses an {@link OidcAccountServiceDelegate} to customize claim building.
 *
 * Since this class uses generics, it cannot be decorated with `@Injectable()`.
 * Register it via the {@link OIDC_ACCOUNT_SERVICE_TOKEN} token with a factory provider.
 */
export class OidcAccountService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> {
  constructor(
    readonly authService: FirebaseServerAuthService<U>,
    readonly delegate: OidcAccountServiceDelegate<U>
  ) {}

  /**
   * Creates a user context for the given user ID.
   */
  userContext(uid: string): OidcAccountServiceUserContext<U> {
    return new OidcAccountServiceUserContext<U>(this, uid);
  }
}
