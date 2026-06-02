import { type FirebaseServerAuthService, type FirebaseServerAuthUserContext } from '@dereekb/firebase-server';
import type { OidcAccount, OidcAccountClaims } from './oidc.account';
import type { OidcProviderConfig } from '../oidc.config';
import { type OidcScope } from '@dereekb/firebase';

// MARK: Delegate
/**
 * Delegate interface that allows customizing how OIDC claims are built from a user context.
 *
 * Generic on `S` to type-check scope names at compile time, and on `U` to allow
 * custom Firebase Auth user context types.
 *
 * The delegate also carries the {@link OidcProviderConfig} so that provider-level
 * settings (claims mapping, response types, grant types) are defined alongside
 * the claim-building logic they correspond to.
 *
 * @example
 * ```typescript
 * type MyScopes = 'openid' | 'profile' | 'email';
 *
 * const delegate: OidcAccountServiceDelegate<MyScopes> = {
 *   providerConfig: {
 *     claims: {
 *       openid: ['sub'],
 *       profile: ['name', 'picture'],
 *       email: ['email', 'email_verified']
 *     },
 *     responseTypes: ['code'],
 *     grantTypes: ['authorization_code', 'refresh_token']
 *   },
 *   async buildClaimsForUser(userContext, scopes) {
 *     const user = await userContext.loadRecord();
 *     const claims: OidcAccountClaims = { sub: user.uid };
 *
 *     if (scopes.has('profile')) {
 *       claims.name = user.displayName;
 *     }
 *
 *     if (scopes.has('email')) {
 *       claims.email = user.email;
 *       claims.email_verified = user.emailVerified ?? false;
 *     }
 *
 *     return claims;
 *   }
 * };
 * ```
 */
export abstract class OidcAccountServiceDelegate<S extends OidcScope = OidcScope, U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> {
  /**
   * Provider-level OIDC configuration (scopes/claims mapping, response types, grant types).
   *
   * The keys of `claims` define the supported scopes and must align with the
   * scope checks performed in {@link buildClaimsForUser}.
   */
  abstract readonly providerConfig: OidcProviderConfig<S>;

  /**
   * Builds claims for the given user context based on the requested scopes.
   *
   * @param userContext - The Firebase Auth user context.
   * @param scopes - The set of requested OIDC scopes, typed to the `S` union.
   * @returns The claims to return for this user.
   */
  abstract buildClaimsForUser(userContext: U, scopes: Set<S>): Promise<OidcAccountClaims> | OidcAccountClaims;

  /**
   * Resolves whether the given user is an admin, used to gate
   * {@link OidcProviderConfig.adminOnlyScopes} at consent time.
   *
   * Implementations should resolve admin status from the user's raw auth claims/roles
   * independently of the requested OIDC scopes (do not rely on a scope-gated claim builder),
   * so the check is authoritative regardless of which scopes the client requested.
   *
   * Optional: when omitted, the consent flow treats the user as a non-admin, hard-rejecting any
   * request for an admin-only scope.
   *
   * @param userContext - The Firebase Auth user context.
   * @returns Whether the user is an admin.
   */
  isAdminUser?(userContext: U): Promise<boolean>;
}

// MARK: User Context
/**
 * Per-user context for OIDC account operations.
 *
 * Created by {@link OidcAccountService.userContext} for a specific user ID.
 */
export class OidcAccountServiceUserContext<S extends OidcScope = OidcScope, U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> {
  readonly authUserContext: U;

  constructor(
    private readonly _service: OidcAccountService<S, U>,
    private readonly _uid: string
  ) {
    this.authUserContext = this._service.authService.userContext(this._uid);
  }

  get uid(): string {
    return this._uid;
  }

  get service(): OidcAccountService<S, U> {
    return this._service;
  }

  /**
   * Finds this user's OIDC account representation.
   *
   * Returns an {@link OidcAccount} compatible with oidc-provider's `findAccount` interface,
   * or `undefined` if the user does not exist in Firebase Auth.
   *
   * @returns The OIDC account for this user, or undefined if the user does not exist.
   */
  async findAccount(): Promise<OidcAccount | undefined> {
    const authUserContext = this.authUserContext;
    const exists = await authUserContext.exists();
    let result: OidcAccount | undefined;

    if (exists) {
      const delegate = this._service.delegate;

      result = {
        accountId: this._uid,
        async claims(_use: string, scope: string): Promise<OidcAccountClaims> {
          const scopes = new Set(scope.split(' ')) as Set<S>;
          return delegate.buildClaimsForUser(authUserContext, scopes);
        }
      };
    }

    return result;
  }
}

// MARK: Service
/**
 * Service that provides OIDC account lookup backed by Firebase Auth.
 *
 * Uses an {@link OidcAccountServiceDelegate} to customize claim building
 * and to carry the provider-level OIDC configuration.
 *
 * Register it as a provider using the `OidcAccountService` class as the injection token.
 */
export class OidcAccountService<S extends OidcScope = OidcScope, U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> {
  constructor(
    readonly authService: FirebaseServerAuthService<U>,
    readonly delegate: OidcAccountServiceDelegate<S, U>
  ) {}

  /**
   * The provider config from the delegate.
   *
   * @returns The OIDC provider configuration from the delegate.
   */
  get providerConfig(): OidcProviderConfig<S> {
    return this.delegate.providerConfig;
  }

  /**
   * Creates a user context for the given user ID.
   *
   * @param uid - The Firebase Auth user ID.
   * @returns A new user context bound to the given user.
   */
  userContext(uid: string): OidcAccountServiceUserContext<S, U> {
    return new OidcAccountServiceUserContext<S, U>(this, uid);
  }
}
