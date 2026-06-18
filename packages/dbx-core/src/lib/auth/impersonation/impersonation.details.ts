import { type Type, type Provider, forwardRef } from '@angular/core';
import { type AuthRoleSet, type EmailAddress, type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { type AuthUserIdentifier } from '../auth.user';

/**
 * Minimal, extensible view of an impersonated user, loaded on demand by a {@link DbxAuthImpersonationDelegate}.
 *
 * The generic `T` is the provider/app-specific raw payload (for example HelloSubs' `FindUserResult`)
 * carried on {@link DbxAuthImpersonationDetails.raw}, so a downstream consumer that produced it via the
 * delegate can read it back fully typed without re-fetching.
 *
 * @typeParam T - The provider-specific raw payload type carried on {@link DbxAuthImpersonationDetails.raw}.
 */
export interface DbxAuthImpersonationDetails<T = unknown> {
  /**
   * Identifier of the impersonated user.
   */
  readonly userId: AuthUserIdentifier;
  /**
   * Display name of the impersonated user, if available.
   */
  readonly displayName?: Maybe<string>;
  /**
   * Email address of the impersonated user, if available.
   */
  readonly email?: Maybe<EmailAddress>;
  /**
   * Avatar/photo URL of the impersonated user, if available.
   */
  readonly photoURL?: Maybe<string>;
  /**
   * Authorization roles of the impersonated user, if available.
   */
  readonly roles?: Maybe<AuthRoleSet>;
  /**
   * The raw payload the delegate fetched for this user. Lets the consumer that supplied the delegate
   * read its own provider object back without re-fetching.
   */
  readonly raw: T;
}

/**
 * Abstract delegate used by {@link DbxAuthImpersonationService} to load details for an impersonated user.
 *
 * Optional: when no delegate is provided, {@link DbxAuthImpersonationService.impersonationDetails$} emits
 * `undefined`. Register a concrete implementation with {@link provideDbxAuthImpersonationDelegate} (or via
 * the `delegateType` option of `provideDbxAuthImpersonation`).
 *
 * @typeParam T - The provider-specific raw payload type carried on {@link DbxAuthImpersonationDetails.raw}.
 */
export abstract class DbxAuthImpersonationDelegate<T = unknown> {
  /**
   * Loads details for the given impersonated user.
   *
   * @param userId - The identifier of the user being impersonated.
   * @returns Observable of the loaded details, or `undefined` when none can be loaded.
   */
  abstract loadImpersonationDetails(userId: AuthUserIdentifier): Observable<Maybe<DbxAuthImpersonationDetails<T>>>;
}

/**
 * Creates Angular DI providers that register the given source type as a {@link DbxAuthImpersonationDelegate}.
 *
 * Registers the class itself (so it is instantiable) and aliases the abstract {@link DbxAuthImpersonationDelegate}
 * token to it via `useExisting`.
 *
 * @param sourceType - The class to provide as the delegate.
 * @returns Array of Angular providers.
 *
 * @typeParam S - The concrete delegate class type to register.
 */
export function provideDbxAuthImpersonationDelegate<S extends DbxAuthImpersonationDelegate>(sourceType: Type<S>): Provider[] {
  const providers: Provider[] = [
    sourceType,
    {
      provide: DbxAuthImpersonationDelegate,
      useExisting: forwardRef(() => sourceType)
    }
  ];

  return providers;
}
