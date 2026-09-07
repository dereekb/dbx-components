import { filterMaybe, isNot, timeoutStartWith } from '@dereekb/rxjs';
import { Injectable, inject } from '@angular/core';
import { type AuthUserState, type DbxAuthService, loggedOutObsFromIsLoggedIn, loggedInObsFromIsLoggedIn, type AuthUserIdentifier, authUserIdentifier, type NoAuthUserIdentifier, type DbxAuthImpersonationDetails } from '@dereekb/dbx-core';
import {
  reauthenticateWithPopup,
  reauthenticateWithRedirect,
  type User,
  type IdTokenResult,
  type ParsedToken,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type AuthProvider,
  type PopupRedirectResolver,
  signInAnonymously,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  type UserCredential,
  createUserWithEmailAndPassword,
  linkWithPopup,
  linkWithRedirect,
  linkWithCredential,
  unlink,
  type AuthCredential,
  sendPasswordResetEmail,
  confirmPasswordReset
} from 'firebase/auth';
import { FIREBASE_AUTH_TOKEN } from '../../firebase/firebase.tokens';
import { firebaseAuthState, firebaseIdToken } from './firebase.auth.rxjs.util';
import { of, type Observable, distinctUntilChanged, shareReplay, map, switchMap, firstValueFrom, catchError, EMPTY, Subject, merge, tap } from 'rxjs';
import { type AuthClaims, type AuthClaimsObject, type AuthRoleClaimsService, type AuthRoleSet, AUTH_ADMIN_ROLE, cachedGetter, type Maybe, type PasswordString } from '@dereekb/util';
import { type AuthUserInfo, authUserInfoFromAuthUser, firebaseAuthTokenFromUser } from '../auth';
import { authUserStateFromFirebaseAuthServiceFunction } from './firebase.auth.rxjs';
import { type FirebaseAuthIdToken, type FirebaseAuthContextInfo, type FirebaseAuthOobCode } from '@dereekb/firebase';
import { DBX_FIREBASE_AUTH_FLOW_TOKEN, DEFAULT_DBX_FIREBASE_AUTH_FLOW, type DbxFirebaseAuthFlow, type DbxFirebaseResolvedAuthFlow, resolveDbxFirebaseAuthFlow } from './firebase.auth.flow';

/**
 * Returns an observable that derives the current {@link AuthUserState} from the given auth service.
 */
export type AuthUserStateObsFunction = (dbxFirebaseAuthService: DbxFirebaseAuthService) => Observable<AuthUserState>;

/**
 * Input for completing a password reset.
 *
 * In the default Firebase flow, `oobCode` is the out-of-band code from the reset email link.
 * When overridden via the delegate (e.g., custom claims-based flow), `oobCode` can represent
 * any verification token the backend expects.
 *
 * @example
 * ```ts
 * await authService.completePasswordReset({
 *   oobCode: 'abc123',
 *   newPassword: 'myNewSecurePassword'
 * });
 * ```
 */
export interface DbxFirebaseCompletePasswordResetInput {
  /**
   * Verification code from the password reset email. Semantics depend on the delegate implementation.
   */
  readonly oobCode: FirebaseAuthOobCode;
  /**
   * The new password to set for the user's account.
   */
  readonly newPassword: PasswordString;
}

// MARK: Delegate
/**
 * Delegate that customizes the behavior of {@link DbxFirebaseAuthService}.
 *
 * Provides extension points for auth state derivation, role mapping, onboarding checks,
 * and password reset flows. Override individual methods to integrate with custom backends
 * (e.g., claims-based reset via a callable function) while keeping defaults for the rest.
 *
 * @example
 * ```ts
 * const delegate: DbxFirebaseAuthServiceDelegate = {
 *   ...DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE,
 *   sendPasswordReset: async (service, email) => {
 *     await myCustomResetApi(email);
 *   }
 * };
 * ```
 */
export abstract class DbxFirebaseAuthServiceDelegate {
  /**
   * When true, the delegate has full control over the {@link AuthUserState} observable
   * and the service will not wrap it with its own logged-in/logged-out logic.
   */
  readonly fullControlOfAuthUserState?: boolean = false;
  abstract authUserStateObs: AuthUserStateObsFunction;
  abstract authRolesObs(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<AuthRoleSet>;
  abstract isOnboarded(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<boolean>;
  /**
   * Whether or not the input roles imply admin privileges.
   */
  abstract isAdminInAuthRoleSet(authRoleSet: AuthRoleSet): boolean;
  abstract authRoleClaimsService?: Maybe<AuthRoleClaimsService<AuthClaimsObject>>;
  /**
   * Sends a password reset email to the given email address.
   *
   * The default implementation uses Firebase's built-in `sendPasswordResetEmail()`.
   * Override to route through a custom backend (e.g., a callable function that triggers
   * a claims-based reset and sends a templated email).
   *
   * @param dbxFirebaseAuthService - the auth service instance, providing access to `firebaseAuth`
   * @param email - the email address to send the reset to
   */
  abstract sendPasswordReset(dbxFirebaseAuthService: DbxFirebaseAuthService, email: string): Promise<void>;
  /**
   * Completes a password reset using a verification code and new password.
   *
   * The default implementation uses Firebase's built-in `confirmPasswordReset()` with the oobCode.
   * Override to route through a custom backend (e.g., a callable function that verifies
   * a claims-based reset code and sets the new password).
   *
   * @param dbxFirebaseAuthService - the auth service instance, providing access to `firebaseAuth`
   * @param input - the verification code and new password
   */
  abstract completePasswordReset(dbxFirebaseAuthService: DbxFirebaseAuthService, input: DbxFirebaseCompletePasswordResetInput): Promise<void>;
  /**
   * Loads display details for an impersonated user (the "view as another user" feature).
   *
   * There is no built-in Firebase API to read another user's profile from the client, so this has no
   * meaningful default beyond returning `undefined`. Override it to fetch the user's details via your
   * backend (e.g. a callable function), returning a {@link DbxAuthImpersonationDetails} with the raw
   * provider payload on `raw`.
   *
   * @param dbxFirebaseAuthService - The auth service instance.
   * @param userId - The identifier of the user being impersonated.
   */
  loadImpersonationAuthDetails?(dbxFirebaseAuthService: DbxFirebaseAuthService, userId: AuthUserIdentifier): Observable<Maybe<DbxAuthImpersonationDetails>>;
}

/**
 * Default {@link DbxFirebaseAuthServiceDelegate} that uses Firebase's built-in auth methods.
 *
 * Password reset uses `sendPasswordResetEmail()` and `confirmPasswordReset()` from `firebase/auth`.
 * Auth state defaults to `'user'` when logged in, `'none'` otherwise.
 */
export const DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE: DbxFirebaseAuthServiceDelegate = {
  authUserStateObs: authUserStateFromFirebaseAuthServiceFunction(),
  authRolesObs(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<AuthRoleSet> {
    return dbxFirebaseAuthService.authUserState$.pipe(map((x) => (x === 'user' ? new Set(['user']) : new Set())));
  },
  isOnboarded(dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<boolean> {
    return dbxFirebaseAuthService.authUserState$.pipe(map((x) => x === 'user'));
  },
  isAdminInAuthRoleSet(authRoleSet: AuthRoleSet): boolean {
    return authRoleSet.has(AUTH_ADMIN_ROLE);
  },
  sendPasswordReset(dbxFirebaseAuthService: DbxFirebaseAuthService, email: string): Promise<void> {
    return sendPasswordResetEmail(dbxFirebaseAuthService.firebaseAuth, email);
  },
  completePasswordReset(dbxFirebaseAuthService: DbxFirebaseAuthService, input: DbxFirebaseCompletePasswordResetInput): Promise<void> {
    return confirmPasswordReset(dbxFirebaseAuthService.firebaseAuth, input.oobCode, input.newPassword);
  },
  loadImpersonationAuthDetails(): Observable<Maybe<DbxAuthImpersonationDetails>> {
    return of(undefined);
  }
};

// MARK: Per-User Streams
/**
 * Configuration for {@link sharedObservableForUidFunction}.
 */
interface SharedObservableForUidFunctionConfig<I, T> {
  /**
   * Reads the uid that the input's observable is scoped to.
   */
  readonly uidForInput: (input: I) => Maybe<AuthUserIdentifier>;
  /**
   * Creates the observable for the input. Invoked once per uid change.
   */
  readonly factoryForInput: (input: I) => Observable<T>;
}

/**
 * Creates a function that returns a shared observable scoped to the input's uid, discarding and rebuilding it
 * whenever the uid changes.
 *
 * Exists because a `shareReplay()` buffer cannot be cleared: a shared stream that outlives the signed-in user
 * hands the NEXT user's subscribers a value derived from the PREVIOUS user's token, synchronously. Any consumer
 * that reads the first emission — the UIRouter auth transition hooks, for instance — then acts on data belonging
 * to a different user. Rebuilding per-uid gives a same-page re-login (log out, log back in as someone else
 * without reloading) the same cold-start behavior as a page reload.
 *
 * The per-uid observable should use `refCount: true` so the discarded uid's source is torn down rather than
 * leaking one live subscription per user switch. That is safe here because the returned observable is only
 * consumed through a `switchMap`, so its reference count tracks the outer subscribers exactly.
 *
 * @param config - The uid reader and the per-uid observable factory.
 * @returns Function that returns the shared observable for the input.
 */
function sharedObservableForUidFunction<I, T>(config: SharedObservableForUidFunctionConfig<I, T>): (input: I) => Observable<T> {
  const { uidForInput, factoryForInput } = config;

  let current: Maybe<{ readonly uid: Maybe<AuthUserIdentifier>; readonly obs: Observable<T> }>;

  return (input: I) => {
    const uid = uidForInput(input);

    if (current == null || current.uid !== uid) {
      current = { uid, obs: factoryForInput(input) };
    }

    return current.obs;
  };
}

// MARK: Service
@Injectable()
export class DbxFirebaseAuthService implements DbxAuthService {
  readonly firebaseAuth = inject(FIREBASE_AUTH_TOKEN);
  readonly delegate = inject(DbxFirebaseAuthServiceDelegate, { optional: true }) ?? DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE;
  readonly authFlow: DbxFirebaseAuthFlow = inject(DBX_FIREBASE_AUTH_FLOW_TOKEN, { optional: true }) ?? DEFAULT_DBX_FIREBASE_AUTH_FLOW;

  readonly _authState$: Observable<Maybe<User>> = firebaseAuthState(this.firebaseAuth);

  /**
   * Subject that triggers a re-emission of the current auth user.
   *
   * Useful after operations that mutate the {@link User} object in place (e.g., linking/unlinking providers)
   * without triggering a new {@link authState} emission.
   */
  private readonly _authUpdate$ = new Subject<void>();

  readonly currentAuthUser$: Observable<Maybe<User>> = merge(this._authState$, this._authUpdate$.pipe(map(() => this.firebaseAuth.currentUser))).pipe(timeoutStartWith(null as Maybe<User>, 1000), shareReplay(1));
  readonly currentAuthUserInfo$: Observable<Maybe<AuthUserInfo>> = this.currentAuthUser$.pipe(map((x) => (x ? authUserInfoFromAuthUser(x) : undefined)));

  readonly authUser$: Observable<User> = this.currentAuthUser$.pipe(filterMaybe());
  readonly authUserInfo$: Observable<AuthUserInfo> = this.authUser$.pipe(map(authUserInfoFromAuthUser));

  readonly hasAuthUser$: Observable<boolean> = this.currentAuthUser$.pipe(map(Boolean), distinctUntilChanged(), shareReplay(1));

  readonly isAnonymousUser$: Observable<boolean> = this.authUser$.pipe(
    map((x) => x.isAnonymous),
    distinctUntilChanged(),
    shareReplay(1)
  );
  readonly isNotAnonymousUser$: Observable<boolean> = this.isAnonymousUser$.pipe(isNot(), distinctUntilChanged(), shareReplay(1));

  /**
   * Observable of provider IDs currently linked to the authenticated user.
   *
   * @example
   * ```ts
   * authService.currentLinkedProviderIds$.subscribe(ids => console.log(ids));
   * // ['google.com', 'facebook.com']
   * ```
   */
  readonly currentLinkedProviderIds$: Observable<string[]> = this.currentAuthUser$.pipe(
    map((user) => (user ? user.providerData.map((p) => p.providerId) : [])),
    distinctUntilChanged((a, b) => a.length === b.length && a.every((v, i) => v === b[i])),
    shareReplay(1)
  );

  readonly isLoggedIn$: Observable<boolean> = this.hasAuthUser$;
  readonly isNotLoggedIn$: Observable<boolean> = this.isLoggedIn$.pipe(isNot());
  readonly onLogIn$: Observable<void> = loggedInObsFromIsLoggedIn(this.isLoggedIn$);
  readonly onLogOut$: Observable<void> = loggedOutObsFromIsLoggedIn(this.isLoggedIn$);

  readonly currentUid$: Observable<Maybe<AuthUserIdentifier>> = this.currentAuthUser$.pipe(
    map((x) => x?.uid),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly uid$: Observable<AuthUserIdentifier | NoAuthUserIdentifier> = this.currentUid$.pipe(map(authUserIdentifier), distinctUntilChanged(), shareReplay(1));
  /**
   * Alias for uid$
   */
  readonly userIdentifier$: Observable<AuthUserIdentifier | NoAuthUserIdentifier> = this.uid$;

  /**
   * The current ID token string, or null while logged out.
   *
   * Scoped per-uid via {@link sharedObservableForUidFunction} so the replay buffer can never hand a subscriber
   * the PREVIOUS user's token after a same-page re-login.
   */
  readonly currentIdTokenString$: Observable<Maybe<FirebaseAuthIdToken>> = (() => {
    const sharedForUid = sharedObservableForUidFunction<Maybe<AuthUserIdentifier>, Maybe<FirebaseAuthIdToken>>({
      uidForInput: (uid) => uid,
      factoryForInput: (uid) => (uid == null ? of(null) : firebaseIdToken(this.firebaseAuth).pipe(distinctUntilChanged(), shareReplay({ bufferSize: 1, refCount: true })))
    });

    return this.currentUid$.pipe(switchMap((uid) => sharedForUid(uid)));
  })();

  readonly idTokenString$: Observable<FirebaseAuthIdToken> = this.currentUid$.pipe(switchMap((x) => (x ? this.currentIdTokenString$.pipe(filterMaybe()) : EMPTY)));

  /**
   * The current user's decoded ID token, or null while logged out.
   *
   * Scoped per-uid via {@link sharedObservableForUidFunction}. Token refreshes still flow through, as they arrive
   * on {@link currentIdTokenString$}; only a uid change rebuilds the stream.
   */
  readonly currentIdTokenResult$: Observable<Maybe<IdTokenResult>> = (() => {
    const sharedForUser = sharedObservableForUidFunction<Maybe<User>, Maybe<IdTokenResult>>({
      uidForInput: (user) => user?.uid,
      factoryForInput: (user) =>
        user == null
          ? of(null)
          : this.currentIdTokenString$.pipe(
              switchMap((token) => (token ? user.getIdTokenResult() : of(null))),
              distinctUntilChanged(),
              shareReplay({ bufferSize: 1, refCount: true })
            )
    });

    return this.currentAuthUser$.pipe(
      distinctUntilChanged((a, b) => a?.uid === b?.uid),
      switchMap((user) => sharedForUser(user))
    );
  })();

  readonly idTokenResult$: Observable<IdTokenResult> = this.currentIdTokenResult$.pipe(filterMaybe());

  /**
   * The current user's token claims, or null while logged out.
   *
   * Intentionally not replayed: {@link currentIdTokenResult$} is already shared per-uid, and a buffer here would
   * reintroduce the cross-user staleness that scoping removes.
   */
  readonly currentClaims$: Observable<Maybe<ParsedToken>> = this.currentIdTokenResult$.pipe(
    map((x) => (x ? x.claims : null)),
    distinctUntilChanged()
  );
  readonly claims$: Observable<ParsedToken> = this.currentClaims$.pipe(filterMaybe());

  readonly currentAuthContextInfo$: Observable<Maybe<DbxFirebaseAuthContextInfo>> = this.currentAuthUser$.pipe(
    switchMap((x) => this.loadAuthContextInfoForUser(x)),
    shareReplay(1)
  );
  readonly authContextInfo$: Observable<Maybe<DbxFirebaseAuthContextInfo>> = this.currentAuthContextInfo$.pipe(filterMaybe());

  /**
   * The current {@link AuthUserState}.
   *
   * The delegate's state stream is scoped per-uid via {@link sharedObservableForUidFunction}, so it is rebuilt
   * whenever the signed-in uid changes. Without that, a subscriber attaching right after a same-page re-login is
   * served the prior session's state synchronously from the replay buffer — and every consumer that reads the
   * first emission, including the UIRouter auth transition hooks, then routes on it. The delegate factory is
   * re-invoked per uid so the delegate's own internal replay is discarded along with it.
   */
  readonly authUserState$: Observable<AuthUserState> = (() => {
    const fullControlOfAuthUserState = Boolean(this.delegate.fullControlOfAuthUserState);

    const sharedDelegateStateForUid = sharedObservableForUidFunction<Maybe<User>, AuthUserState>({
      uidForInput: (user) => user?.uid,
      factoryForInput: (user) => {
        let obs: Observable<AuthUserState>;

        if (user == null && !fullControlOfAuthUserState) {
          obs = of<AuthUserState>('none');
        } else {
          obs = this.delegate.authUserStateObs(this).pipe(
            catchError(() => of('error' as AuthUserState)),
            distinctUntilChanged(),
            shareReplay({ bufferSize: 1, refCount: true })
          );
        }

        return obs;
      }
    });

    return this._authState$.pipe(
      distinctUntilChanged((a, b) => a?.uid === b?.uid),
      switchMap((user) => sharedDelegateStateForUid(user))
    );
  })();

  readonly authRoles$: Observable<AuthRoleSet> = this.delegate.authRolesObs(this);
  readonly isOnboarded$: Observable<boolean> = this.delegate.isOnboarded(this);

  private _authRoleClaimsService?: Maybe<AuthRoleClaimsService<AuthClaimsObject>> = this.delegate.authRoleClaimsService;
  readonly isAdminInAuthRoleSet: (authRoleSet: AuthRoleSet) => boolean = this.delegate.isAdminInAuthRoleSet;

  async refreshToken(): Promise<IdTokenResult> {
    const user = this.firebaseAuth.currentUser;

    if (!user) {
      throw new Error('no user to refresh the token for.');
    }

    return user.getIdTokenResult(true);
  }

  rolesForClaims<T extends AuthClaimsObject = AuthClaimsObject>(claims: AuthClaims<T>): AuthRoleSet {
    let result: AuthRoleSet;

    if (this._authRoleClaimsService) {
      result = this._authRoleClaimsService.toRoles(claims);
    } else {
      console.warn('DbxFirebaseAuthService: rolesForClaims called with no authRoleClaimsService provided. An empty set is returned.');
      result = new Set();
    }

    return result;
  }

  getAuthContextInfo(): Promise<Maybe<DbxFirebaseAuthContextInfo>> {
    return firstValueFrom(this.authUser$).then((user) => this.loadAuthContextInfoForUser(user));
  }

  async loadAuthContextInfoForUser(user: Maybe<User>): Promise<Maybe<DbxFirebaseAuthContextInfo>> {
    let result: Maybe<DbxFirebaseAuthContextInfo>;

    if (user) {
      const jwtToken: IdTokenResult = await user.getIdTokenResult();
      result = dbxFirebaseAuthContextInfo(this, user, jwtToken);
    }

    return result;
  }

  /**
   * The auth flow this service uses for the `*WithDefaultFlow` methods, with `auto` resolved to `popup` or `redirect`.
   *
   * Resolved on each call so `auto` reflects the current display mode.
   *
   * @returns The resolved auth flow.
   */
  resolvedAuthFlow(): DbxFirebaseResolvedAuthFlow {
    return resolveDbxFirebaseAuthFlow(this.authFlow);
  }

  logInWithPopup(provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<UserCredential> {
    return signInWithPopup(this.firebaseAuth, provider, resolver);
  }

  /**
   * Begins sign-in with the given provider via a full-page redirect.
   *
   * The page navigates away and the credential is delivered on reload via {@link handleRedirectResult}
   * (`getRedirectResult`), so the returned promise never resolves with a credential.
   *
   * @param provider - The auth provider to sign in with.
   * @param resolver - Optional popup/redirect resolver.
   * @returns Nothing usable — the page navigates away and the flow completes on reload via {@link handleRedirectResult}.
   */
  logInWithRedirect(provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<never> {
    return signInWithRedirect(this.firebaseAuth, provider, resolver);
  }

  /**
   * Signs in with the given provider using the configured {@link DbxFirebaseAuthService.authFlow}.
   *
   * Uses {@link logInWithRedirect} when the resolved flow is `redirect` (in which case the promise
   * never resolves with a credential — the page navigates and sign-in completes on reload), otherwise
   * {@link logInWithPopup}.
   *
   * @param provider - The auth provider to sign in with.
   * @param resolver - Optional popup/redirect resolver.
   * @returns Promise resolving to the user credential (popup flow only).
   */
  logInWithDefaultFlow(provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<UserCredential> {
    return this.resolvedAuthFlow() === 'redirect' ? this.logInWithRedirect(provider, resolver) : this.logInWithPopup(provider, resolver);
  }

  /**
   * Links an additional authentication provider to the current user via popup.
   *
   * @param provider - The auth provider to link.
   * @param resolver - Optional popup redirect resolver.
   * @returns Promise resolving to the user credential after linking.
   *
   * @example
   * ```ts
   * await authService.linkWithPopup(new GoogleAuthProvider());
   * ```
   */
  linkWithPopup(provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<UserCredential> {
    return firstValueFrom(
      this.currentAuthUser$.pipe(
        switchMap((x: Maybe<User>) => {
          if (x) {
            return linkWithPopup(x, provider, resolver);
          }
          throw new Error('User is not logged in currently.');
        }),
        tap(() => this._authUpdate$.next())
      )
    );
  }

  /**
   * Links an additional authentication provider to the current user via a full-page redirect.
   *
   * The page navigates away; the link completes on reload via {@link handleRedirectResult}, which
   * pushes an auth-state refresh so `currentLinkedProviderIds$` updates (linking does not trigger
   * `onAuthStateChanged`).
   *
   * @param provider - The auth provider to link.
   * @param resolver - Optional popup/redirect resolver.
   * @returns Nothing usable — the page navigates away and the flow completes on reload via {@link handleRedirectResult}.
   */
  linkWithRedirect(provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<never> {
    return firstValueFrom(
      this.currentAuthUser$.pipe(
        switchMap((x: Maybe<User>) => {
          if (x) {
            return linkWithRedirect(x, provider, resolver);
          }
          throw new Error('User is not logged in currently.');
        })
      )
    );
  }

  /**
   * Links an additional authentication provider to the current user using the configured
   * {@link DbxFirebaseAuthService.authFlow}.
   *
   * Uses {@link linkWithRedirect} when the resolved flow is `redirect` (promise never resolves with a
   * credential — the page navigates and the link completes on reload), otherwise {@link linkWithPopup}.
   *
   * @param provider - The auth provider to link.
   * @param resolver - Optional popup/redirect resolver.
   * @returns Promise resolving to the user credential after linking (popup flow only).
   */
  linkWithDefaultFlow(provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<UserCredential> {
    return this.resolvedAuthFlow() === 'redirect' ? this.linkWithRedirect(provider, resolver) : this.linkWithPopup(provider, resolver);
  }

  /**
   * Links a credential to the current user. Useful for merging accounts
   * when a credential-already-in-use error provides an {@link AuthCredential}.
   *
   * @param credential - The auth credential to link.
   * @returns Promise resolving to the user credential after linking.
   *
   * @example
   * ```ts
   * await authService.linkWithCredential(credential);
   * ```
   */
  linkWithCredential(credential: AuthCredential): Promise<UserCredential> {
    return firstValueFrom(
      this.currentAuthUser$.pipe(
        switchMap((x: Maybe<User>) => {
          if (x) {
            return linkWithCredential(x, credential);
          }
          throw new Error('User is not logged in currently.');
        }),
        tap(() => this._authUpdate$.next())
      )
    );
  }

  /**
   * Unlinks an authentication provider from the current user.
   *
   * @param providerId - The provider ID to unlink (e.g., 'google.com').
   * @returns Promise resolving to the updated user.
   *
   * @example
   * ```ts
   * await authService.unlinkProvider('google.com');
   * ```
   */
  unlinkProvider(providerId: string): Promise<User> {
    return firstValueFrom(
      this.currentAuthUser$.pipe(
        switchMap((x: Maybe<User>) => {
          if (x) {
            return unlink(x, providerId);
          }
          throw new Error('User is not logged in currently.');
        }),
        tap(() => this._authUpdate$.next())
      )
    );
  }

  registerWithEmailAndPassword(email: string, password: string): Promise<UserCredential> {
    return createUserWithEmailAndPassword(this.firebaseAuth, email, password);
  }

  /**
   * Sends a password reset email to the given address via the configured delegate.
   *
   * @param email - The email address to send the reset to.
   * @returns Resolves when the email has been sent.
   *
   * @example
   * ```ts
   * await authService.sendPasswordReset('user@example.com');
   * ```
   */
  sendPasswordReset(email: string): Promise<void> {
    return this.delegate.sendPasswordReset(this, email);
  }

  /**
   * Completes a password reset using the verification code and new password via the configured delegate.
   *
   * @param input - The verification code and new password.
   * @returns Resolves when the password has been reset.
   *
   * @example
   * ```ts
   * await authService.completePasswordReset({ oobCode: 'abc123', newPassword: 'newPass' });
   * ```
   */
  completePasswordReset(input: DbxFirebaseCompletePasswordResetInput): Promise<void> {
    return this.delegate.completePasswordReset(this, input);
  }

  /**
   * Loads display details for an impersonated user via the configured delegate.
   *
   * Returns `undefined` when the delegate provides no `loadImpersonationAuthDetails` implementation.
   *
   * @param userId - The identifier of the user being impersonated.
   * @returns Observable of the loaded details, or `undefined` when none are available.
   */
  loadImpersonationAuthDetails(userId: AuthUserIdentifier): Observable<Maybe<DbxAuthImpersonationDetails>> {
    return this.delegate.loadImpersonationAuthDetails ? this.delegate.loadImpersonationAuthDetails(this, userId) : of(undefined);
  }

  logInWithEmailAndPassword(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.firebaseAuth, email, password);
  }

  logInAsAnonymous(): Promise<UserCredential> {
    return signInAnonymously(this.firebaseAuth);
  }

  /**
   * Signs in with a Firebase custom token minted by this app's server.
   *
   * The bridge for a third-party provider Firebase Auth has no native provider for: the server
   * authenticates the user against that provider, resolves them to a uid, and mints a token for it.
   *
   * The resulting user has NO `providerData` entry — there is no Firebase provider behind them — so
   * the link/unlink surface does not apply. Managing that third-party identity is the external
   * connection flow's job. The server's stored custom claims are spread to the top level of the
   * exchanged ID token as usual, so security rules behave exactly as for any other sign-in.
   *
   * No `_authUpdate$` nudge is needed: this fires `onAuthStateChanged` like any other sign-in.
   *
   * @param token - The custom token from the server.
   * @returns The credential for the signed-in user.
   */
  logInWithCustomToken(token: string): Promise<UserCredential> {
    return signInWithCustomToken(this.firebaseAuth, token);
  }

  logOut(): Promise<void> {
    return this.firebaseAuth.signOut();
  }

  reauthenticateWithPopup(provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<UserCredential> {
    return firstValueFrom(
      this.currentAuthUser$.pipe(
        switchMap((x: Maybe<User>) => {
          if (x) {
            return reauthenticateWithPopup(x, provider, resolver);
          }
          throw new Error('User is not logged in currently.');
        })
      )
    );
  }

  /**
   * Reauthenticates the current user with the given provider via a full-page redirect.
   *
   * The page navigates away; reauthentication completes on reload via {@link handleRedirectResult}.
   *
   * @param provider - The auth provider to reauthenticate with.
   * @param resolver - Optional popup/redirect resolver.
   * @returns Nothing usable — the page navigates away and the flow completes on reload via {@link handleRedirectResult}.
   */
  reauthenticateWithRedirect(provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<never> {
    return firstValueFrom(
      this.currentAuthUser$.pipe(
        switchMap((x: Maybe<User>) => {
          if (x) {
            return reauthenticateWithRedirect(x, provider, resolver);
          }
          throw new Error('User is not logged in currently.');
        })
      )
    );
  }

  /**
   * Reauthenticates the current user using the configured {@link DbxFirebaseAuthService.authFlow}.
   *
   * Uses {@link reauthenticateWithRedirect} when the resolved flow is `redirect` (promise never
   * resolves with a credential — the page navigates and reauthentication completes on reload),
   * otherwise {@link reauthenticateWithPopup}.
   *
   * @param provider - The auth provider to reauthenticate with.
   * @param resolver - Optional popup/redirect resolver.
   * @returns Promise resolving to the user credential (popup flow only).
   */
  reauthenticateWithDefaultFlow(provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<UserCredential> {
    return this.resolvedAuthFlow() === 'redirect' ? this.reauthenticateWithRedirect(provider, resolver) : this.reauthenticateWithPopup(provider, resolver);
  }

  /**
   * Completes a pending redirect-based sign-in/link/reauthenticate started by a `*WithRedirect` method.
   *
   * Should be called once on app startup (wired via `provideDbxFirebaseAuth({ authFlow })`). When a
   * redirect result is present it pushes an auth-state refresh so link/reauthenticate results (which do
   * not trigger `onAuthStateChanged`) are reflected in `currentAuthUser$` / `currentLinkedProviderIds$`.
   *
   * @returns The redirect {@link UserCredential} when one is pending, otherwise `undefined`.
   */
  async handleRedirectResult(): Promise<Maybe<UserCredential>> {
    const result = await getRedirectResult(this.firebaseAuth);

    if (result != null) {
      this._authUpdate$.next();
    }

    return result;
  }
}

/**
 * FirebaseAuthContextInfo implementation from DbxFirebaseAuthService.
 */
export interface DbxFirebaseAuthContextInfo extends FirebaseAuthContextInfo {
  readonly service: DbxFirebaseAuthService;
  readonly user: User;
  readonly jwtToken: IdTokenResult;
}

/**
 * Creates a new DbxFirebaseAuthContextInfo instance.
 *
 * @param service
 * @param user
 * @param jwtToken
 * @returns
 */
export function dbxFirebaseAuthContextInfo(service: DbxFirebaseAuthService, user: User, jwtToken: IdTokenResult): DbxFirebaseAuthContextInfo {
  function getClaims<T extends AuthClaimsObject = AuthClaimsObject>(): AuthClaims<T> {
    return jwtToken.claims as AuthClaims<T>;
  }

  const { uid } = user;
  const token = firebaseAuthTokenFromUser(user);
  const getAuthRoles = cachedGetter(() => service.rolesForClaims(getClaims()));
  const isAdmin = cachedGetter(() => service.isAdminInAuthRoleSet(getAuthRoles()));

  const result: DbxFirebaseAuthContextInfo = {
    service,
    user,
    jwtToken,

    uid,

    isAdmin,
    getClaims,
    getAuthRoles,

    token
  };

  return result;
}
