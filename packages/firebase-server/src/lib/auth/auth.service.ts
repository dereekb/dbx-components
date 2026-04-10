import type * as admin from 'firebase-admin';
import {
  type FirebaseAuthContextInfo,
  type FirebaseAuthDetails,
  type FirebaseAuthUserId,
  type FirebaseAuthNewUserClaimsData,
  type FirebaseAuthSetupPassword,
  type FirebaseAuthResetUserPasswordClaimsData,
  FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY,
  FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY,
  FIREBASE_SERVER_AUTH_CLAIMS_RESET_PASSWORD_KEY,
  FIREBASE_SERVER_AUTH_CLAIMS_RESET_LAST_COM_DATE_KEY,
  FIREBASE_AUTH_EMAIL_ALREADY_EXISTS_ERROR,
  FIREBASE_AUTH_INVALID_PHONE_NUMBER_ERROR,
  FIREBASE_AUTH_PHONE_NUMBER_ALREADY_EXISTS_ERROR
} from '@dereekb/firebase';
import { type Milliseconds, filterUndefinedValues, AUTH_ADMIN_ROLE, type AuthClaims, type AuthRoleSet, cachedGetter, filterNullAndUndefinedValues, type ArrayOrValue, type AuthRole, forEachKeyValue, type ObjectMap, type AuthClaimsUpdate, asSet, KeyValueTypleValueFilter, type AuthClaimsObject, type Maybe, AUTH_TOS_SIGNED_ROLE, type EmailAddress, type E164PhoneNumber, randomNumberFactory, type PasswordString, isThrottled } from '@dereekb/util';
import { assertIsContextWithAuthData, type CallableContextWithAuthData } from '../function/context';
import { type AuthDataRef, firebaseAuthTokenFromDecodedIdToken } from './auth.context';
import { hoursToMs, toISODateString } from '@dereekb/date';
import { getAuthUserOrUndefined } from './auth.util';
import { type AuthUserIdentifier } from '@dereekb/dbx-core';
import { FirebaseServerAuthNewUserSendSetupDetailsNoSetupConfigError, FirebaseServerAuthNewUserSendSetupDetailsSendOnceError, FirebaseServerAuthNewUserSendSetupDetailsThrottleError, FirebaseServerAuthPasswordResetInvalidCodeError, FirebaseServerAuthPasswordResetNoResetConfigError, FirebaseServerAuthPasswordResetSendOnceError, FirebaseServerAuthPasswordResetThrottleError, FirebaseServerAuthUserBadInputError, FirebaseServerAuthUserExistsError } from './auth.service.error';
import { type CallableContext } from '../type';

/**
 * Generates a random 6-digit number for use as a temporary password or reset token.
 *
 * Used internally by {@link AbstractFirebaseServerAuthUserContext.beginResetPassword} and
 * {@link AbstractFirebaseServerNewUserService.generateRandomSetupPassword} for one-time codes.
 *
 * @example
 * ```typescript
 * const pin = DEFAULT_FIREBASE_PASSWORD_NUMBER_GENERATOR(); // e.g. 482910
 * ```
 */
export const DEFAULT_FIREBASE_PASSWORD_NUMBER_GENERATOR = randomNumberFactory({ min: 100000, max: 1000000, round: 'floor' });

/**
 * Identifies a Firebase Auth user by UID within a server-side auth context.
 *
 * Base interface for {@link FirebaseServerAuthUserContext} and {@link FirebaseServerAuthContext}.
 */
export interface FirebaseServerAuthUserIdentifierContext {
  /**
   * UID of the user for this context.
   */
  readonly uid: FirebaseAuthUserId;
}

/**
 * Custom claims stored on a user during a password reset flow.
 *
 * Contains the temporary reset password and the timestamp of when the reset was initiated.
 */
export interface FirebaseServerAuthResetUserPasswordClaims extends FirebaseAuthResetUserPasswordClaimsData, AuthClaimsObject {}

/**
 * Provides operations for managing a single Firebase Auth user's record, claims, roles, and password.
 *
 * Acts as a scoped context bound to a specific user UID, enabling direct manipulation of that user's
 * authentication state without requiring the caller to repeatedly pass the UID.
 *
 * @example
 * ```typescript
 * const userCtx = authService.userContext(uid);
 * const exists = await userCtx.exists();
 * const roles = await userCtx.loadRoles();
 * await userCtx.addRoles(AUTH_ADMIN_ROLE);
 * ```
 */
export interface FirebaseServerAuthUserContext extends FirebaseServerAuthUserIdentifierContext {
  /**
   * Checks whether the user exists in Firebase Auth.
   */
  exists(): Promise<boolean>;

  /**
   * Loads the full Firebase Auth {@link admin.auth.UserRecord} for this user.
   *
   * @throws Throws if the user does not exist.
   */
  loadRecord(): Promise<admin.auth.UserRecord>;

  /**
   * Loads a normalized {@link FirebaseAuthDetails} snapshot of the user's auth profile.
   *
   * @throws Throws if the user does not exist.
   */
  loadDetails(): Promise<FirebaseAuthDetails>;

  /**
   * Initiates a password reset flow by generating a random temporary password,
   * storing reset claims on the user, and updating the user's password.
   *
   * The returned claims contain the generated password and a timestamp, which can be
   * communicated to the user through an external channel (e.g., email).
   */
  beginResetPassword(): Promise<FirebaseServerAuthResetUserPasswordClaims>;

  /**
   * Loads the reset password claims if a password reset is currently active.
   *
   * @returns The reset claims, or `undefined` if no reset is in progress.
   */
  loadResetPasswordClaims<T extends FirebaseServerAuthResetUserPasswordClaims = FirebaseServerAuthResetUserPasswordClaims>(): Promise<Maybe<T>>;

  /**
   * Updates the user's password and clears any active password reset claims.
   *
   * Intended to be called after the user has verified their identity with a reset token.
   *
   * @param password - The new password to set.
   */
  setPassword(password: PasswordString): Promise<admin.auth.UserRecord>;

  /**
   * Applies an arbitrary update to the user's Firebase Auth record.
   *
   * @param template - The update fields to apply.
   */
  updateUser(template: admin.auth.UpdateRequest): Promise<admin.auth.UserRecord>;

  /**
   * Loads the user's current {@link AuthRoleSet} by reading and converting their custom claims.
   */
  loadRoles(): Promise<AuthRoleSet>;

  /**
   * Merges the given roles into the user's existing roles via claim updates.
   *
   * Does not affect roles not associated with the given input.
   *
   * @param roles - One or more roles to add.
   */
  addRoles(roles: ArrayOrValue<AuthRole>): Promise<void>;

  /**
   * Removes the given roles from the user by nullifying their corresponding claims.
   *
   * Does not affect claims belonging to other roles.
   *
   * @param roles - One or more roles to remove.
   */
  removeRoles(roles: ArrayOrValue<AuthRole>): Promise<void>;

  /**
   * Replaces all of the user's role-based claims with those derived from the given roles.
   *
   * All previous claims are cleared before the new role claims are applied.
   *
   * @param roles - The complete set of roles the user should have.
   */
  setRoles(roles: AuthRole[] | AuthRoleSet): Promise<void>;

  /**
   * Loads the user's raw custom claims object from their Firebase Auth record.
   *
   * @throws Throws if the user does not exist.
   */
  loadClaims<T extends AuthClaimsObject = AuthClaimsObject>(): Promise<AuthClaims<T>>;

  /**
   * Merges the input claims into the user's existing custom claims.
   *
   * - Keys with `null` values are removed from the resulting claims.
   * - Keys with `undefined` values are ignored (existing values are preserved).
   *
   * @param claims - Partial claims to merge. Use `null` to delete a key.
   */
  updateClaims<T extends AuthClaimsObject = AuthClaimsObject>(claims: AuthClaimsUpdate<T>): Promise<void>;

  /**
   * Replaces the user's entire custom claims object. All previous claims are discarded.
   *
   * @param claims - The new claims to set.
   */
  setClaims<T extends AuthClaimsObject = AuthClaimsObject>(claims: AuthClaimsUpdate<T>): Promise<void>;

  /**
   * Removes all custom claims from the user.
   */
  clearClaims(): Promise<void>;
}

/**
 * Base implementation of {@link FirebaseServerAuthUserContext} that manages a single user's
 * auth state (record, claims, roles, password) through the Firebase Admin Auth API.
 *
 * Caches the user record on first load and resets the cache automatically when claims are modified
 * via {@link setClaims}. Subclass this to bind it to a specific {@link FirebaseServerAuthService} type.
 *
 * @example
 * ```typescript
 * export class MyAuthUserContext extends AbstractFirebaseServerAuthUserContext<MyAuthService> {}
 *
 * const ctx = new MyAuthUserContext(authService, 'some-uid');
 * const roles = await ctx.loadRoles();
 * await ctx.addRoles(AUTH_ADMIN_ROLE);
 * ```
 */
export abstract class AbstractFirebaseServerAuthUserContext<S extends FirebaseServerAuthService> implements FirebaseServerAuthUserContext {
  private readonly _service: S;
  private readonly _uid: FirebaseAuthUserId;
  private readonly _loadRecord = cachedGetter(() => this._service.auth.getUser(this._uid));

  constructor(service: S, uid: FirebaseAuthUserId) {
    this._service = service;
    this._uid = uid;
  }

  get service() {
    return this._service;
  }

  get uid() {
    return this._uid;
  }

  async exists(): Promise<boolean> {
    return getAuthUserOrUndefined(this._loadRecord()).then((x) => Boolean(x));
  }

  loadRecord(): Promise<admin.auth.UserRecord> {
    return this._loadRecord();
  }

  loadDetails(): Promise<FirebaseAuthDetails> {
    return this.loadRecord().then((record) => this.service.authDetailsForRecord(record));
  }

  /**
   * Generates a random numeric string for use as a temporary reset password.
   *
   * @returns A random numeric string suitable as a temporary password.
   */
  protected _generateResetPasswordKey(): string {
    return String(DEFAULT_FIREBASE_PASSWORD_NUMBER_GENERATOR());
  }

  async beginResetPassword(): Promise<FirebaseServerAuthResetUserPasswordClaims> {
    const password = this._generateResetPasswordKey();
    const passwordClaimsData: FirebaseServerAuthResetUserPasswordClaims = {
      [FIREBASE_SERVER_AUTH_CLAIMS_RESET_PASSWORD_KEY]: password,
      [FIREBASE_SERVER_AUTH_CLAIMS_RESET_LAST_COM_DATE_KEY]: toISODateString(new Date())
    };

    // set the claims
    await this.updateClaims(passwordClaimsData);

    // update the user
    await this.updateUser({ password });

    return passwordClaimsData;
  }

  async loadResetPasswordClaims<T extends FirebaseServerAuthResetUserPasswordClaims = FirebaseServerAuthResetUserPasswordClaims>(): Promise<Maybe<T>> {
    const claims = await this.loadClaims<T>();

    const result: Maybe<T> = claims.resetPassword != null ? claims : undefined;
    return result;
  }

  async setPassword(password: PasswordString): Promise<admin.auth.UserRecord> {
    const record = await this.updateUser({ password });

    // clear password reset claims
    await this.updateClaims({
      [FIREBASE_SERVER_AUTH_CLAIMS_RESET_PASSWORD_KEY]: null,
      [FIREBASE_SERVER_AUTH_CLAIMS_RESET_LAST_COM_DATE_KEY]: null
    });

    return record;
  }

  async updateUser(template: admin.auth.UpdateRequest): Promise<admin.auth.UserRecord> {
    return this.service.auth.updateUser(this.uid, template);
  }

  async loadRoles(): Promise<AuthRoleSet> {
    const claims = await this.loadClaims();
    return this.service.readRoles(claims);
  }

  async addRoles(roles: ArrayOrValue<AuthRole>): Promise<void> {
    const claims = this._claimsForRolesChange(roles);
    return this.updateClaims(claims);
  }

  async removeRoles(roles: ArrayOrValue<AuthRole>): Promise<void> {
    const baseClaims = this._claimsForRolesChange(roles);
    const claims: ObjectMap<null> = {};

    forEachKeyValue(baseClaims, {
      forEach: ([key]) => {
        claims[key] = null; // set null on every key
      },
      filter: KeyValueTypleValueFilter.NONE // don't skip any key/value
    });

    return this.updateClaims(claims);
  }

  /**
   * Replaces all role-based claims with those derived from the given roles.
   *
   * All existing claims are cleared first. Use `claimsToRetain` to preserve non-role claims
   * (e.g., setup or application-specific claims) through the replacement.
   *
   * @param roles - The complete set of roles to assign.
   * @param claimsToRetain - Additional claims to merge in alongside the role-derived claims.
   * @returns Resolves when the claims have been replaced.
   *
   * @example
   * ```typescript
   * // Set roles while preserving a custom claim
   * await userCtx.setRoles([AUTH_ADMIN_ROLE], { customFlag: 1 });
   * ```
   */
  async setRoles<T extends AuthClaimsObject = AuthClaimsObject>(roles: AuthRole[] | AuthRoleSet, claimsToRetain?: Partial<T>): Promise<void> {
    const claims = {
      ...claimsToRetain,
      ...this._claimsForRolesChange([...roles])
    };

    return this.setClaims(claims);
  }

  /**
   * Converts roles to their corresponding claim keys, filtering out null/undefined entries
   * that represent unrelated claims in the service's {@link FirebaseServerAuthService.claimsForRoles} output.
   *
   * @param roles - The roles to convert to claims.
   * @returns Filtered claims object with only the relevant role-based entries.
   */
  protected _claimsForRolesChange(roles: ArrayOrValue<AuthRole>) {
    return filterNullAndUndefinedValues(this.service.claimsForRoles(asSet(roles)));
  }

  loadClaims<T extends AuthClaimsObject = AuthClaimsObject>(): Promise<AuthClaims<T>> {
    return this.loadRecord().then((x) => (x.customClaims ?? {}) as AuthClaims<T>);
  }

  async updateClaims<T extends AuthClaimsObject = AuthClaimsObject>(claims: AuthClaimsUpdate<T>): Promise<void> {
    const currentClaims = await this.loadClaims();

    let newClaims: AuthClaimsUpdate<T> = {
      ...currentClaims,
      ...filterUndefinedValues(claims, false)
    };

    newClaims = filterNullAndUndefinedValues(newClaims);

    return this.setClaims(newClaims);
  }

  clearClaims(): Promise<void> {
    return this.setClaims(null);
  }

  setClaims<T extends AuthClaimsObject = AuthClaimsObject>(claims: AuthClaimsUpdate<T> | null): Promise<void> {
    return this.service.auth.setCustomUserClaims(this.uid, claims).then(() => {
      this._loadRecord.reset(); // reset the cache
    });
  }
}

// MARK: FirebaseServerAuthContext
/**
 * Read-only auth context derived from a Firebase callable function request.
 *
 * Provides access to the caller's identity, decoded token, roles, and admin/ToS status
 * without requiring additional async lookups. Created by {@link FirebaseServerAuthService.context}
 * after asserting that the request contains valid auth data.
 *
 * @example
 * ```typescript
 * const authCtx = authService.context(callableContext);
 * if (authCtx.isAdmin) {
 *   // handle admin-only logic
 * }
 * const roles = authCtx.authRoles;
 * ```
 */
export interface FirebaseServerAuthContext<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> extends FirebaseServerAuthUserIdentifierContext {
  /**
   * The original callable function context containing the authenticated request data.
   */
  readonly context: CallableContextWithAuthData;

  /**
   * A {@link FirebaseServerAuthUserContext} for performing mutations on this user's auth record.
   */
  readonly userContext: U;

  /**
   * Whether the caller has the {@link AUTH_ADMIN_ROLE} based on their token claims.
   */
  readonly isAdmin: boolean;

  /**
   * Whether the caller has signed the terms of service based on their token claims.
   */
  readonly hasSignedTos: boolean;

  /**
   * The full set of auth roles derived from the caller's token claims.
   */
  readonly authRoles: AuthRoleSet;

  /**
   * The decoded ID token from the request.
   */
  readonly token: admin.auth.DecodedIdToken;

  /**
   * The raw custom claims from the decoded ID token.
   */
  readonly claims: AuthClaims;
}

/**
 * Base implementation of {@link FirebaseServerAuthContext} with cached getters for roles, admin status,
 * and ToS status to avoid redundant computation within a single request.
 *
 * @example
 * ```typescript
 * export class MyAuthContext extends AbstractFirebaseServerAuthContext<MyAuthContext, MyUserContext, MyAuthService> {}
 * ```
 */
export abstract class AbstractFirebaseServerAuthContext<C extends FirebaseServerAuthContext, U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, S extends FirebaseServerAuthService<U, C> = FirebaseServerAuthService<U, C>> implements FirebaseServerAuthContext {
  private readonly _service: S;
  private readonly _context: CallableContextWithAuthData;

  private readonly _authRoles = cachedGetter(() => this.service.readRoles(this.claims));
  private readonly _isAdmin = cachedGetter(() => this.service.isAdminInRoles(this._authRoles()));
  private readonly _hasSignedTos = cachedGetter(() => this.service.hasSignedTosInRoles(this._authRoles()));
  private readonly _userContext = cachedGetter(() => this.service.userContext(this.context.auth.uid));

  constructor(service: S, context: CallableContextWithAuthData) {
    this._service = service;
    this._context = context;
  }

  get service() {
    return this._service;
  }

  get context() {
    return this._context;
  }

  get userContext() {
    return this._userContext();
  }

  get isAdmin(): boolean {
    return this._isAdmin();
  }

  get hasSignedTos(): boolean {
    return this._hasSignedTos();
  }

  get authRoles(): AuthRoleSet {
    return this._authRoles();
  }

  get token(): admin.auth.DecodedIdToken {
    return this.context.auth.token;
  }

  get claims(): AuthClaims {
    return this.context.auth.token as unknown as AuthClaims;
  }

  // MARK: FirebaseServerAuthUserContext
  get uid(): string {
    return this.userContext.uid;
  }
}

// MARK: New Account Initialization
/**
 * Custom claims stored on a user during account setup, containing the setup password
 * and the last communication timestamp.
 */
export interface FirebaseServerAuthNewUserClaims extends FirebaseAuthNewUserClaimsData, AuthClaimsObject {}

/**
 * Configuration for creating and initializing a new Firebase Auth user.
 *
 * Supports creating users by email or phone, assigning a temporary setup password,
 * and optionally sending setup content (e.g., an invitation email) immediately after creation.
 *
 * @example
 * ```typescript
 * await newUserService.initializeNewUser({
 *   email: 'user@example.com',
 *   sendSetupContent: true,
 *   sendSetupThrowErrors: true
 * });
 * ```
 */
export interface FirebaseServerAuthInitializeNewUser<D = unknown> {
  /**
   * Specific user identifier to use.
   */
  readonly uid?: Maybe<FirebaseAuthUserId>;
  /**
   * User's display name
   */
  readonly displayName?: Maybe<string>;
  /**
   * Email for the new user, if applicable.
   */
  readonly email?: Maybe<EmailAddress>;
  /**
   * Phone for the new user, if applicable. Must be a valid {@link E164PhoneNumber} (e.g. `'+17206620850'`).
   *
   * Firebase Auth requires E.164 format. If the value is not valid, {@link FirebaseServerAuthUserBadInputError}
   * is thrown with code `auth/invalid-phone-number`.
   */
  readonly phone?: Maybe<E164PhoneNumber>;
  /**
   * Temporary setup password assigned during account creation.
   *
   * This is not the user's permanent password; it is replaced when the user completes setup.
   */
  readonly setupPassword?: Maybe<FirebaseAuthSetupPassword>;
  /**
   * Whether or not to send a setup email. Is false by default.
   */
  readonly sendSetupContent?: Maybe<boolean>;
  /**
   * Whether or not to resend a setup email if the user already existed. Is false by default.
   */
  readonly sendSetupContentIfUserExists?: Maybe<boolean>;
  /**
   * If true, and the setup content has been sent before, it will not be sent again.
   */
  readonly sendSetupDetailsOnce?: Maybe<boolean>;
  /**
   * If true, will ignore throttling when sending setup content.
   */
  readonly sendSetupIgnoreThrottle?: Maybe<boolean>;
  /**
   * Whether or not to throw an error if sending setup content fails. Is false by default.
   */
  readonly sendSetupThrowErrors?: Maybe<boolean>;
  /**
   * Whether or not to force sending the test details.
   */
  readonly sendDetailsInTestEnvironment?: Maybe<boolean>;
  /**
   * Any additional setup context
   */
  readonly data?: Maybe<D>;
}

/**
 * Result of creating a new Firebase Auth user, including the generated temporary setup password.
 */
export interface FirebaseServerAuthCreateNewUserResult {
  readonly user: admin.auth.UserRecord;
  readonly password: FirebaseAuthSetupPassword;
}

/**
 * Configuration options for sending setup content (e.g., invitation emails) to a new user.
 *
 * Controls throttling, send-once behavior, and error handling for the delivery process.
 */
export interface FirebaseServerAuthNewUserSendSetupDetailsConfig<D = unknown> {
  /**
   * Whether or not to force sending the test details. Usage differs between providers.
   */
  readonly sendDetailsInTestEnvironment?: Maybe<boolean>;
  /**
   * Whether or not to skip sending again if the setup content has already been sent once.
   */
  readonly sendSetupDetailsOnce?: Maybe<boolean>;
  /**
   * Whether or not to force sending again even if the send is being throttled
   */
  readonly ignoreSendThrottleTime?: Maybe<boolean>;
  /**
   * Whether or not to throw errors if the send fails, instead of returning false.
   *
   * @see FirebaseServerAuthNewUserSendSetupDetailsNoSetupConfigError
   * @see FirebaseServerAuthNewUserSendSetupDetailsThrottleError
   */
  readonly throwErrors?: Maybe<boolean>;
  /**
   * Any additional setup context
   */
  readonly data?: Maybe<D>;
}

/**
 * Details about a user that is in the setup phase, including their user context,
 * setup claims data, and the send configuration that was used.
 */
export interface FirebaseServerAuthNewUserSetupDetails<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, D = unknown> extends FirebaseServerAuthNewUserSendSetupDetailsConfig<D> {
  readonly userContext: U;
  readonly claims: FirebaseAuthNewUserClaimsData;
}

/**
 * Service for programmatically creating new Firebase Auth users and managing their setup lifecycle.
 *
 * Handles user creation, setup password assignment, setup content delivery (with throttling),
 * and marking user setup as complete by clearing setup-related claims.
 *
 * @example
 * ```typescript
 * const newUserSvc = authService.newUser();
 * const record = await newUserSvc.initializeNewUser({ email: 'user@example.com', sendSetupContent: true });
 * // Later, after the user completes onboarding:
 * await newUserSvc.markUserSetupAsComplete(record.uid);
 * ```
 */
export interface FirebaseServerNewUserService<D = unknown, U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> {
  /**
   * Creates a new user (or finds an existing one) and optionally sends setup content.
   *
   * If the user already exists, no new account is created. Setup content is only sent
   * when explicitly requested via the input flags.
   *
   * @param input - Configuration for the new user and setup content delivery.
   * @throws Throws if neither email, phone, nor uid is provided.
   */
  initializeNewUser(input: FirebaseServerAuthInitializeNewUser<D>): Promise<admin.auth.UserRecord>;
  /**
   * Writes the setup password claim to the user's custom claims.
   *
   * If no password is provided, a random one is generated.
   *
   * @param userContextOrUid - The user to update, as a context or UID string.
   * @param setupPassword - Optional explicit setup password; auto-generated if omitted.
   */
  addNewUserSetupClaims(userContextOrUid: U | FirebaseAuthUserId, setupPassword?: FirebaseAuthSetupPassword): Promise<U>;
  /**
   * Sends setup content (e.g., an invitation email) to the user.
   *
   * Respects throttling and send-once constraints from the config. Returns `true` if
   * content was actually sent, `false` if skipped due to throttling or send-once rules.
   *
   * @param uid - The target user's UID.
   * @param data - Optional delivery configuration.
   * @throws {FirebaseServerAuthNewUserSendSetupDetailsThrottleError} When throttled and `throwErrors` is true.
   * @throws {FirebaseServerAuthNewUserSendSetupDetailsSendOnceError} When already sent and `sendSetupDetailsOnce` + `throwErrors` are true.
   * @throws {FirebaseServerAuthNewUserSendSetupDetailsNoSetupConfigError} When no setup claims exist and `throwErrors` is true.
   */
  sendSetupContent(uid: FirebaseAuthUserId, data?: FirebaseServerAuthNewUserSendSetupDetailsConfig<D>): Promise<boolean>;
  /**
   * Loads the setup details for the user if they are in the setup phase.
   *
   * @param uid - The target user's UID.
   * @param config - Optional config to forward to the details.
   * @returns The setup details, or `undefined` if the user does not exist or has no setup claims.
   */
  loadSetupDetails(uid: FirebaseAuthUserId, config?: FirebaseServerAuthNewUserSendSetupDetailsConfig<D>): Promise<Maybe<FirebaseServerAuthNewUserSetupDetails<U, D>>>;
  /**
   * Loads the setup details for a user context that is already resolved.
   *
   * @param userContext - The resolved user context.
   * @param config - Optional config to forward to the details.
   * @returns The setup details, or `undefined` if the user has no setup claims.
   */
  loadSetupDetailsForUserContext(userContext: U, config?: FirebaseServerAuthNewUserSendSetupDetailsConfig<D>): Promise<Maybe<FirebaseServerAuthNewUserSetupDetails<U, D>>>;
  /**
   * Clears all setup-related claims from the user, marking their setup as complete.
   *
   * @param uid - The target user's UID.
   * @returns `true` if the user existed and was updated, `false` if the user was not found.
   */
  markUserSetupAsComplete(uid: FirebaseAuthUserId): Promise<boolean>;
}

/**
 * Default throttle duration (1 hour) between setup content sends to prevent spam.
 *
 * Used by {@link AbstractFirebaseServerNewUserService.sendSetupContent} to rate-limit delivery.
 */
export const DEFAULT_SETUP_COM_THROTTLE_TIME = hoursToMs(1);

/**
 * A user context instance or a raw UID string that can be resolved to one.
 */
export type UserContextOrUid<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> = U | FirebaseAuthUserId;

/**
 * Resolves a {@link UserContextOrUid} to a concrete user context instance.
 *
 * If a string UID is provided, creates a new user context via the auth service.
 * If an existing context is provided, returns it as-is.
 *
 * @param authService - The auth service to create a context from if needed.
 * @param userContextOrUid - A user context or UID string.
 * @returns The resolved user context instance.
 *
 * @example
 * ```typescript
 * const ctx = userContextFromUid(authService, 'some-uid');
 * const sameCtx = userContextFromUid(authService, ctx); // returns ctx unchanged
 * ```
 */
export function userContextFromUid<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext>(authService: FirebaseServerAuthService<U>, userContextOrUid: UserContextOrUid<U>): U {
  const userContext: U = typeof userContextOrUid === 'string' ? authService.userContext(userContextOrUid) : userContextOrUid;
  return userContext;
}

/**
 * Base implementation of {@link FirebaseServerNewUserService} that handles user creation,
 * setup claims management, throttled setup content delivery, and setup completion.
 *
 * Subclasses must implement {@link sendSetupContentToUser} to define how setup content
 * (e.g., invitation email, SMS) is delivered to the user.
 *
 * @example
 * ```typescript
 * export class MyNewUserService extends AbstractFirebaseServerNewUserService<MyUserContext> {
 *   protected async sendSetupContentToUser(details: FirebaseServerAuthNewUserSetupDetails<MyUserContext>): Promise<void> {
 *     await this.emailService.sendInvite(details.userContext.uid, details.claims.setupPassword);
 *   }
 * }
 * ```
 */
export abstract class AbstractFirebaseServerNewUserService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, C extends FirebaseServerAuthContext = FirebaseServerAuthContext, D = unknown> implements FirebaseServerNewUserService<D, U> {
  private readonly _authService: FirebaseServerAuthService<U, C>;

  /**
   * Minimum time between setup content sends. Defaults to {@link DEFAULT_SETUP_COM_THROTTLE_TIME} (1 hour).
   * Override in subclasses to customize the throttle window.
   */
  protected setupThrottleTime: Milliseconds = DEFAULT_SETUP_COM_THROTTLE_TIME;

  constructor(authService: FirebaseServerAuthService<U, C>) {
    this._authService = authService;
  }

  get authService() {
    return this._authService;
  }

  async initializeNewUser(input: FirebaseServerAuthInitializeNewUser<D>): Promise<admin.auth.UserRecord> {
    const { uid, email, phone, sendSetupContent, sendSetupContentIfUserExists, sendSetupDetailsOnce, sendSetupIgnoreThrottle, sendSetupThrowErrors, data, sendDetailsInTestEnvironment } = input;

    // Existing user lookup uses a priority-based approach: uid > email > phone.
    // Only the highest-priority identifier provided is used for the lookup. If both email and phone
    // are provided, only the email is checked. This means that if the email is new but the phone
    // belongs to an existing account, the lookup will not find an existing user, and createNewUser()
    // will be called. If createUser() then fails because the phone (or another identifier) is already
    // in use, a FirebaseServerAuthUserExistsError or FirebaseServerAuthUserBadInputError is thrown.
    // Callers providing multiple identifiers should handle these errors accordingly.
    let userRecordPromise: Promise<admin.auth.UserRecord>;

    if (uid) {
      userRecordPromise = this.authService.auth.getUser(uid);
    } else if (email) {
      userRecordPromise = this.authService.auth.getUserByEmail(email);
    } else if (phone) {
      userRecordPromise = this.authService.auth.getUserByPhoneNumber(phone);
    } else {
      throw new Error('email or phone is required to initialize a new user.');
    }

    let userRecord: Maybe<admin.auth.UserRecord> = await getAuthUserOrUndefined(userRecordPromise);
    let userRecordId: AuthUserIdentifier;
    let createdUser = false;

    if (!userRecord) {
      const createResult = await this.createNewUser(input);

      // add the setup password to the user's credentials
      const userContext = this.authService.userContext(createResult.user.uid);
      await this.addNewUserSetupClaims(userContext, createResult.password);

      createdUser = true;
      userRecordId = userContext.uid;
      userRecord = await userContext.loadRecord();
    } else {
      userRecordId = userRecord.uid;
    }

    // send content if necessary
    if ((createdUser && sendSetupContent === true) || sendSetupContentIfUserExists) {
      const sentEmail = await this.sendSetupContent(userRecordId, { data, sendSetupDetailsOnce, ignoreSendThrottleTime: sendSetupIgnoreThrottle, throwErrors: sendSetupThrowErrors, sendDetailsInTestEnvironment });

      // reload the user record
      if (sentEmail) {
        const userContext = this.authService.userContext(userRecordId);
        userRecord = await userContext.loadRecord();
      }
    }

    return userRecord;
  }

  async addNewUserSetupClaims(userContextOrUid: U | FirebaseAuthUserId, setupPassword?: FirebaseAuthSetupPassword): Promise<U> {
    const password = setupPassword ?? this.generateRandomSetupPassword();

    const userContext: U = userContextFromUid<U>(this.authService, userContextOrUid);
    await userContext.updateClaims({
      [FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY]: password
    });

    return userContext;
  }

  async sendSetupContent(userContextOrUid: U | FirebaseAuthUserId, config?: FirebaseServerAuthNewUserSendSetupDetailsConfig<D>): Promise<boolean> {
    const setupDetails: Maybe<FirebaseServerAuthNewUserSetupDetails<U, D>> = await this.loadSetupDetails(userContextOrUid, config);
    let sentContent = false;

    if (setupDetails) {
      // Cast to string | undefined because claims are cast from raw custom claims which may not have this field at runtime
      const setupCommunicationAt = setupDetails.claims.setupCommunicationAt as string | undefined;
      const hasSentCommunication = Boolean(setupCommunicationAt);

      if (config?.sendSetupDetailsOnce && hasSentCommunication) {
        // do not send.
        if (config.throwErrors) {
          throw new FirebaseServerAuthNewUserSendSetupDetailsSendOnceError();
        }
      } else {
        const lastSentAt = setupCommunicationAt ? new Date(setupCommunicationAt) : undefined;
        const sendIsThrottled = hasSentCommunication && !config?.ignoreSendThrottleTime && isThrottled(this.setupThrottleTime, lastSentAt);

        if (!sendIsThrottled) {
          await this.sendSetupContentToUser(setupDetails);
          await this.updateSetupContentSentTime(setupDetails);
          sentContent = true;
        } else if (config?.throwErrors) {
          throw new FirebaseServerAuthNewUserSendSetupDetailsThrottleError(lastSentAt as Date);
        }
      }
    } else if (config?.throwErrors) {
      throw new FirebaseServerAuthNewUserSendSetupDetailsNoSetupConfigError();
    }

    return sentContent;
  }

  async loadSetupDetails(userContextOrUid: U | FirebaseAuthUserId, config?: FirebaseServerAuthNewUserSendSetupDetailsConfig<D>): Promise<Maybe<FirebaseServerAuthNewUserSetupDetails<U, D>>> {
    const userContext: U = userContextFromUid<U>(this.authService, userContextOrUid);
    const userExists = await userContext.exists();
    let details: Maybe<FirebaseServerAuthNewUserSetupDetails<U, D>>;

    if (userExists) {
      details = await this.loadSetupDetailsForUserContext(userContext, config);
    }

    return details;
  }

  async loadSetupDetailsForUserContext(userContext: U, config?: FirebaseServerAuthNewUserSendSetupDetailsConfig<D>): Promise<Maybe<FirebaseServerAuthNewUserSetupDetails<U, D>>> {
    let details: Maybe<FirebaseServerAuthNewUserSetupDetails<U, D>>;
    const { setupPassword, setupCommunicationAt } = await userContext.loadClaims<FirebaseServerAuthNewUserClaims>();

    if (setupPassword) {
      details = {
        userContext,
        claims: {
          setupPassword,
          setupCommunicationAt
        },
        data: config?.data,
        sendDetailsInTestEnvironment: config?.sendDetailsInTestEnvironment
      };
    }

    return details;
  }

  /**
   * Records the current timestamp as the last setup content communication date in the user's claims.
   *
   * @param details - The user's setup details containing the user context.
   */
  protected async updateSetupContentSentTime(details: FirebaseServerAuthNewUserSetupDetails<U, D>): Promise<void> {
    const setupCommunicationAt = toISODateString(new Date());

    await details.userContext.updateClaims<FirebaseServerAuthNewUserClaims>({
      setupCommunicationAt
    });
  }

  async markUserSetupAsComplete(uid: FirebaseAuthUserId): Promise<boolean> {
    const userContext = this.authService.userContext(uid);
    const userExists = await userContext.exists();

    if (userExists) {
      await this.updateClaimsToClearUser(userContext);
    }

    return userExists;
  }

  /**
   * Creates a new Firebase Auth user from the initialization input.
   *
   * Generates a random setup password if none is provided. Override to customize user creation behavior.
   *
   * @param input - The initialization configuration for the new user.
   * @returns The created user record and the setup password used.
   * @throws Throws if the Firebase Admin SDK rejects the user creation.
   */
  protected async createNewUser(input: FirebaseServerAuthInitializeNewUser<D>): Promise<FirebaseServerAuthCreateNewUserResult> {
    const { uid, displayName, email, phone: phoneNumber, setupPassword: inputPassword } = input;
    const password = inputPassword ?? this.generateRandomSetupPassword();

    let user: admin.auth.UserRecord;

    try {
      user = await this.authService.auth.createUser({
        uid: uid ?? undefined,
        displayName: displayName ?? undefined,
        email: email ?? undefined,
        phoneNumber: phoneNumber ?? undefined,
        password
      });
    } catch (e: unknown) {
      const firebaseError = e as { code?: string };
      const errorCode = firebaseError.code;

      if (errorCode === FIREBASE_AUTH_PHONE_NUMBER_ALREADY_EXISTS_ERROR && phoneNumber) {
        throw new FirebaseServerAuthUserExistsError(errorCode, 'phone', phoneNumber);
      } else if (errorCode === FIREBASE_AUTH_EMAIL_ALREADY_EXISTS_ERROR && email) {
        throw new FirebaseServerAuthUserExistsError(errorCode, 'email', email);
      } else if (errorCode === FIREBASE_AUTH_INVALID_PHONE_NUMBER_ERROR && phoneNumber) {
        throw new FirebaseServerAuthUserBadInputError(errorCode, phoneNumber);
      }

      throw e;
    }

    return {
      user,
      password
    };
  }

  protected generateRandomSetupPassword(): FirebaseAuthSetupPassword {
    return `${DEFAULT_FIREBASE_PASSWORD_NUMBER_GENERATOR()}`;
  }

  /**
   * Delivers setup content (e.g., invitation email, SMS) to the user.
   *
   * Subclasses must implement this to define the actual delivery mechanism.
   *
   * @param details - The user's setup details, including their context and setup claims.
   */
  protected abstract sendSetupContentToUser(details: FirebaseServerAuthNewUserSetupDetails<U, D>): Promise<void>;

  /**
   * Clears setup-related claims (setup password and last communication date) from the user.
   *
   * @param userContext - The user context to clear setup claims from.
   */
  protected async updateClaimsToClearUser(userContext: U): Promise<void> {
    await userContext.updateClaims<FirebaseServerAuthNewUserClaims>({
      [FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY]: null,
      [FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY]: null
    });
  }
}

/**
 * No-op implementation of {@link AbstractFirebaseServerNewUserService} that skips sending setup content.
 *
 * Used as the default {@link FirebaseServerNewUserService} when no custom delivery mechanism is configured.
 */
export class NoSetupContentFirebaseServerNewUserService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> extends AbstractFirebaseServerNewUserService<U> {
  protected async sendSetupContentToUser(_details: FirebaseServerAuthNewUserSetupDetails<U>): Promise<void> {
    // send nothing.
  }
}

// MARK: Password Reset
/**
 * Configuration for initiating a password reset flow for an existing Firebase Auth user.
 *
 * Supports identifying the user by UID or email, and optionally sending reset content
 * (e.g., an email with the temporary password) immediately after initiation.
 *
 * @example
 * ```typescript
 * await passwordResetService.beginPasswordReset({
 *   uid: 'some-uid',
 *   sendResetContent: true,
 *   sendResetThrowErrors: true
 * });
 * ```
 */
export interface FirebaseServerAuthInitiatePasswordReset<D = unknown> {
  /**
   * Specific user identifier to use.
   */
  readonly uid?: Maybe<FirebaseAuthUserId>;
  /**
   * Email for the user, if identifying by email.
   */
  readonly email?: Maybe<EmailAddress>;
  /**
   * Whether or not to send a reset email. Is false by default.
   */
  readonly sendResetContent?: Maybe<boolean>;
  /**
   * If true, and the reset content has been sent before, it will not be sent again.
   */
  readonly sendResetDetailsOnce?: Maybe<boolean>;
  /**
   * If true, will ignore throttling when sending reset content.
   */
  readonly sendResetIgnoreThrottle?: Maybe<boolean>;
  /**
   * Whether or not to throw an error if sending reset content fails. Is false by default.
   */
  readonly sendResetThrowErrors?: Maybe<boolean>;
  /**
   * Whether or not to force sending the test details.
   */
  readonly sendDetailsInTestEnvironment?: Maybe<boolean>;
  /**
   * Any additional reset context.
   */
  readonly data?: Maybe<D>;
}

/**
 * Configuration options for sending password reset content (e.g., reset email) to a user.
 *
 * Controls throttling, send-once behavior, and error handling for the delivery process.
 */
export interface FirebaseServerAuthPasswordResetSendContentConfig<D = unknown> {
  /**
   * Whether or not to force sending the test details. Usage differs between providers.
   */
  readonly sendDetailsInTestEnvironment?: Maybe<boolean>;
  /**
   * Whether or not to skip sending again if the reset content has already been sent once.
   */
  readonly sendResetDetailsOnce?: Maybe<boolean>;
  /**
   * Whether or not to force sending again even if the send is being throttled.
   */
  readonly ignoreSendThrottleTime?: Maybe<boolean>;
  /**
   * Whether or not to throw errors if the send fails, instead of returning false.
   *
   * @see FirebaseServerAuthPasswordResetNoResetConfigError
   * @see FirebaseServerAuthPasswordResetThrottleError
   */
  readonly throwErrors?: Maybe<boolean>;
  /**
   * Any additional reset context.
   */
  readonly data?: Maybe<D>;
}

/**
 * Details about a user that is in the password reset phase, including their user context,
 * reset claims data, and the send configuration that was used.
 */
export interface FirebaseServerAuthPasswordResetDetails<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, D = unknown> extends FirebaseServerAuthPasswordResetSendContentConfig<D> {
  readonly userContext: U;
  readonly claims: FirebaseAuthResetUserPasswordClaimsData;
}

/**
 * Input for completing a password reset, containing the temporary reset code
 * and the desired new password.
 */
export interface FirebaseServerAuthCompletePasswordResetInput {
  /**
   * The temporary reset code from the reset email, to be verified against claims.
   */
  readonly resetPassword: string;
  /**
   * The new password to set after verification succeeds.
   */
  readonly newPassword: PasswordString;
}

/**
 * Service for managing password reset flows for existing Firebase Auth users.
 *
 * Handles initiating password resets (generating temporary passwords), sending reset content
 * (with throttling), loading reset state, and completing the reset by setting a new password.
 *
 * @example
 * ```typescript
 * const resetSvc = authService.passwordReset();
 * const claims = await resetSvc.beginPasswordReset({ uid: 'some-uid', sendResetContent: true });
 * // Later, after user verifies identity:
 * await resetSvc.completePasswordReset('some-uid', { resetPassword: '123456', newPassword: 'newSecure' });
 * ```
 */
export interface FirebaseServerUserPasswordResetService<D = unknown, U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> {
  /**
   * Initiates a password reset for the identified user, generating a temporary password
   * and storing reset claims. Optionally sends reset content (e.g., email) immediately.
   *
   * When `sendResetContent` is true, this method delegates to {@link sendResetContent} and
   * may throw the same errors (throttle, send-once, no-config) depending on the configuration.
   *
   * @param input - Configuration for the reset, including user identification and send options.
   * @throws Throws if neither uid nor email is provided.
   * @throws {FirebaseServerAuthPasswordResetThrottleError} When send is throttled and `sendResetThrowErrors` is true.
   * @throws {FirebaseServerAuthPasswordResetSendOnceError} When already sent and `sendResetDetailsOnce` + `sendResetThrowErrors` are true.
   * @throws {FirebaseServerAuthPasswordResetNoResetConfigError} When no reset claims exist and `sendResetThrowErrors` is true.
   */
  beginPasswordReset(input: FirebaseServerAuthInitiatePasswordReset<D>): Promise<FirebaseServerAuthResetUserPasswordClaims>;
  /**
   * Sends reset content (e.g., a reset email) to the user.
   *
   * Respects throttling and send-once constraints from the config. Returns `true` if
   * content was actually sent, `false` if skipped due to throttling or send-once rules.
   *
   * @param uid - The target user's UID.
   * @param config - Optional delivery configuration.
   * @throws {FirebaseServerAuthPasswordResetThrottleError} When throttled and `throwErrors` is true.
   * @throws {FirebaseServerAuthPasswordResetSendOnceError} When already sent and `sendResetDetailsOnce` + `throwErrors` are true.
   * @throws {FirebaseServerAuthPasswordResetNoResetConfigError} When no reset claims exist and `throwErrors` is true.
   */
  sendResetContent(uid: FirebaseAuthUserId, config?: FirebaseServerAuthPasswordResetSendContentConfig<D>): Promise<boolean>;
  /**
   * Loads the reset details for the user if they are in the reset phase.
   *
   * @param uid - The target user's UID.
   * @param config - Optional config to forward to the details.
   * @returns The reset details, or `undefined` if the user does not exist or has no reset claims.
   */
  loadResetDetails(uid: FirebaseAuthUserId, config?: FirebaseServerAuthPasswordResetSendContentConfig<D>): Promise<Maybe<FirebaseServerAuthPasswordResetDetails<U, D>>>;
  /**
   * Loads the reset details for a user context that is already resolved.
   *
   * @param userContext - The resolved user context.
   * @param config - Optional config to forward to the details.
   * @returns The reset details, or `undefined` if the user has no reset claims.
   */
  loadResetDetailsForUserContext(userContext: U, config?: FirebaseServerAuthPasswordResetSendContentConfig<D>): Promise<Maybe<FirebaseServerAuthPasswordResetDetails<U, D>>>;
  /**
   * Completes the password reset by verifying the temporary reset code against the user's
   * claims and setting the new password. Clears reset claims on success.
   *
   * @param uid - The target user's UID.
   * @param input - The reset code and new password.
   * @throws {FirebaseServerAuthPasswordResetInvalidCodeError} When the reset code is invalid or no reset is active.
   */
  completePasswordReset(uid: FirebaseAuthUserId, input: FirebaseServerAuthCompletePasswordResetInput): Promise<admin.auth.UserRecord>;
}

/**
 * Default throttle duration (1 hour) between reset content sends to prevent spam.
 *
 * Used by {@link AbstractFirebaseServerUserPasswordResetService.sendResetContent} to rate-limit delivery.
 */
export const DEFAULT_RESET_COM_THROTTLE_TIME = hoursToMs(1);

/**
 * Base implementation of {@link FirebaseServerUserPasswordResetService} that handles reset initiation,
 * claims management, throttled reset content delivery, and reset completion.
 *
 * Subclasses must implement {@link sendPasswordResetContentToUser} to define how reset content
 * (e.g., reset email, SMS) is delivered to the user.
 *
 * @example
 * ```typescript
 * export class MyPasswordResetService extends AbstractFirebaseServerUserPasswordResetService<MyUserContext> {
 *   protected async sendPasswordResetContentToUser(details: FirebaseServerAuthPasswordResetDetails<MyUserContext>): Promise<void> {
 *     await this.emailService.sendResetEmail(details.userContext.uid, details.claims.resetPassword);
 *   }
 * }
 * ```
 */
export abstract class AbstractFirebaseServerUserPasswordResetService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, C extends FirebaseServerAuthContext = FirebaseServerAuthContext, D = unknown> implements FirebaseServerUserPasswordResetService<D, U> {
  private readonly _authService: FirebaseServerAuthService<U, C>;

  /**
   * Minimum time between reset content sends. Defaults to {@link DEFAULT_RESET_COM_THROTTLE_TIME} (1 hour).
   * Override in subclasses to customize the throttle window.
   */
  protected resetThrottleTime: Milliseconds = DEFAULT_RESET_COM_THROTTLE_TIME;

  constructor(authService: FirebaseServerAuthService<U, C>) {
    this._authService = authService;
  }

  get authService() {
    return this._authService;
  }

  async beginPasswordReset(input: FirebaseServerAuthInitiatePasswordReset<D>): Promise<FirebaseServerAuthResetUserPasswordClaims> {
    const { uid, email, sendResetContent, sendResetDetailsOnce, sendResetIgnoreThrottle, sendResetThrowErrors, data, sendDetailsInTestEnvironment } = input;

    let resolvedUid: Maybe<FirebaseAuthUserId>;

    if (uid) {
      resolvedUid = uid;
    } else if (email) {
      const userRecord = await this.authService.auth.getUserByEmail(email);
      resolvedUid = userRecord.uid;
    } else {
      throw new Error('uid or email is required to initiate a password reset.');
    }

    const userContext = this.authService.userContext(resolvedUid);
    const claims = await userContext.beginResetPassword();

    if (sendResetContent) {
      await this.sendResetContent(resolvedUid, {
        data,
        sendResetDetailsOnce,
        ignoreSendThrottleTime: sendResetIgnoreThrottle,
        throwErrors: sendResetThrowErrors,
        sendDetailsInTestEnvironment
      });
    }

    return claims;
  }

  async sendResetContent(uid: FirebaseAuthUserId, config?: FirebaseServerAuthPasswordResetSendContentConfig<D>): Promise<boolean> {
    const resetDetails: Maybe<FirebaseServerAuthPasswordResetDetails<U, D>> = await this.loadResetDetails(uid, config);
    let sentContent = false;

    if (resetDetails) {
      const resetCommunicationAt = resetDetails.claims.resetCommunicationAt as string | undefined;
      const hasSentCommunication = Boolean(resetCommunicationAt);

      if (config?.sendResetDetailsOnce && hasSentCommunication) {
        if (config.throwErrors) {
          throw new FirebaseServerAuthPasswordResetSendOnceError();
        }
      } else {
        const lastSentAt = resetCommunicationAt ? new Date(resetCommunicationAt) : undefined;
        const sendIsThrottled = hasSentCommunication && !config?.ignoreSendThrottleTime && isThrottled(this.resetThrottleTime, lastSentAt);

        if (!sendIsThrottled) {
          await this.sendPasswordResetContentToUser(resetDetails);
          await this.updateResetContentSentTime(resetDetails);
          sentContent = true;
        } else if (config?.throwErrors) {
          throw new FirebaseServerAuthPasswordResetThrottleError(lastSentAt as Date);
        }
      }
    } else if (config?.throwErrors) {
      throw new FirebaseServerAuthPasswordResetNoResetConfigError();
    }

    return sentContent;
  }

  async loadResetDetails(uid: FirebaseAuthUserId, config?: FirebaseServerAuthPasswordResetSendContentConfig<D>): Promise<Maybe<FirebaseServerAuthPasswordResetDetails<U, D>>> {
    const userContext: U = this.authService.userContext(uid);
    const userExists = await userContext.exists();
    let details: Maybe<FirebaseServerAuthPasswordResetDetails<U, D>>;

    if (userExists) {
      details = await this.loadResetDetailsForUserContext(userContext, config);
    }

    return details;
  }

  async loadResetDetailsForUserContext(userContext: U, config?: FirebaseServerAuthPasswordResetSendContentConfig<D>): Promise<Maybe<FirebaseServerAuthPasswordResetDetails<U, D>>> {
    let details: Maybe<FirebaseServerAuthPasswordResetDetails<U, D>>;
    const claims = await userContext.loadResetPasswordClaims();

    if (claims) {
      details = {
        userContext,
        claims: {
          resetPassword: claims.resetPassword,
          resetCommunicationAt: claims.resetCommunicationAt
        },
        data: config?.data,
        sendDetailsInTestEnvironment: config?.sendDetailsInTestEnvironment
      };
    }

    return details;
  }

  /**
   * Records the current timestamp as the last reset content communication date in the user's claims.
   *
   * @param details - The user's reset details containing the user context.
   */
  protected async updateResetContentSentTime(details: FirebaseServerAuthPasswordResetDetails<U, D>): Promise<void> {
    const resetCommunicationAt = toISODateString(new Date());

    await details.userContext.updateClaims<FirebaseServerAuthResetUserPasswordClaims>({
      [FIREBASE_SERVER_AUTH_CLAIMS_RESET_LAST_COM_DATE_KEY]: resetCommunicationAt
    });
  }

  async completePasswordReset(uid: FirebaseAuthUserId, input: FirebaseServerAuthCompletePasswordResetInput): Promise<admin.auth.UserRecord> {
    const userContext = this.authService.userContext(uid);
    const claims = await userContext.loadResetPasswordClaims();

    if (!claims || claims.resetPassword !== input.resetPassword) {
      throw new FirebaseServerAuthPasswordResetInvalidCodeError();
    }

    return userContext.setPassword(input.newPassword);
  }

  /**
   * Delivers reset content (e.g., reset email, SMS) to the user.
   *
   * Subclasses must implement this to define the actual delivery mechanism.
   *
   * @param details - The user's reset details, including their context and reset claims.
   */
  protected abstract sendPasswordResetContentToUser(details: FirebaseServerAuthPasswordResetDetails<U, D>): Promise<void>;
}

/**
 * No-op implementation of {@link AbstractFirebaseServerUserPasswordResetService} that skips sending reset content.
 *
 * Used as the default {@link FirebaseServerUserPasswordResetService} when no custom delivery mechanism is configured.
 */
export class NoContentFirebaseServerUserPasswordResetService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> extends AbstractFirebaseServerUserPasswordResetService<U> {
  protected async sendPasswordResetContentToUser(_details: FirebaseServerAuthPasswordResetDetails<U>): Promise<void> {
    // send nothing.
  }
}

// MARK: Service
/**
 * Reference to a FirebaseServerAuthService
 */
export interface FirebaseServerAuthServiceRef<S extends FirebaseServerAuthService = FirebaseServerAuthService> {
  readonly authService: S;
}

/**
 * Abstract contract for a Firebase Server authentication service.
 *
 * Provides the core API for creating auth contexts from callable requests, managing user contexts,
 * checking admin/ToS status, converting between roles and claims, and creating new users.
 *
 * Implement this by extending {@link AbstractFirebaseServerAuthService}, which provides default
 * implementations for most methods and only requires `readRoles`, `claimsForRoles`,
 * `userContext`, and `_context` to be defined.
 *
 * @example
 * ```typescript
 * class MyAuthService extends AbstractFirebaseServerAuthService<MyUserContext, MyAuthContext> {
 *   readRoles(claims: AuthClaims): AuthRoleSet { ... }
 *   claimsForRoles(roles: AuthRoleSet): AuthClaimsUpdate { ... }
 *   userContext(uid: string): MyUserContext { ... }
 *   protected _context(ctx: CallableContextWithAuthData): MyAuthContext { ... }
 * }
 * ```
 */
export abstract class FirebaseServerAuthService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, C extends FirebaseServerAuthContext = FirebaseServerAuthContext> {
  /**
   * The underlying Firebase Admin Auth instance.
   */
  abstract readonly auth: admin.auth.Auth;

  /**
   * Creates a {@link FirebaseServerAuthContext} from a callable function request.
   *
   * Asserts that the request contains valid auth data (a UID is present).
   *
   * @param context - The callable function context from a Firebase function invocation.
   * @throws Throws if the context does not contain authenticated user data.
   */
  abstract context(context: CallableContext): C;

  /**
   * Creates a {@link FirebaseServerAuthUserContext} for direct user manipulation.
   *
   * Does not verify that the user exists; existence should be checked separately if needed.
   *
   * @param uid - The Firebase Auth UID of the target user.
   */
  abstract userContext(uid: FirebaseAuthUserId): U;

  /**
   * Determines whether the given claims indicate admin privileges by converting
   * claims to roles and checking for {@link AUTH_ADMIN_ROLE}.
   *
   * @param claims - The user's custom claims.
   */
  abstract isAdmin(claims: AuthClaims): boolean;

  /**
   * Determines whether the given claims indicate the user has signed the Terms of Service
   * by converting claims to roles and checking for {@link AUTH_TOS_SIGNED_ROLE}.
   *
   * @param claims - The user's custom claims.
   */
  abstract hasSignedTos(claims: AuthClaims): boolean;

  /**
   * Checks whether the given role set includes the {@link AUTH_ADMIN_ROLE}.
   *
   * @param roles - The pre-computed role set to check.
   */
  abstract isAdminInRoles(roles: AuthRoleSet): boolean;

  /**
   * Checks whether the given role set includes the {@link AUTH_TOS_SIGNED_ROLE}.
   *
   * @param roles - The pre-computed role set to check.
   */
  abstract hasSignedTosInRoles(roles: AuthRoleSet): boolean;

  /**
   * Converts raw custom claims into the application's {@link AuthRoleSet}.
   *
   * This is the inverse of {@link claimsForRoles} and defines the claims-to-roles mapping.
   *
   * @param claims - The user's custom claims.
   */
  abstract readRoles(claims: AuthClaims): AuthRoleSet;

  /**
   * Converts an {@link AuthRoleSet} into the corresponding claims update object.
   *
   * The result should include ALL known claim keys, with unset claims set to `null`
   * so they can be cleared from the user's custom claims.
   *
   * @param roles - The roles to convert to claims.
   */
  abstract claimsForRoles(roles: AuthRoleSet): AuthClaimsUpdate;

  /**
   * Builds a {@link FirebaseAuthContextInfo} from an auth data reference, providing
   * lazy accessors for roles, admin status, and claims.
   *
   * @param context - A reference containing auth data (e.g., from a request).
   * @returns The context info, or `undefined` if no auth data is present.
   */
  abstract authContextInfo(context: AuthDataRef): Maybe<FirebaseAuthContextInfo>;

  /**
   * Returns a {@link FirebaseServerNewUserService} for programmatic user creation and setup management.
   */
  abstract newUser(): FirebaseServerNewUserService;

  /**
   * Returns a {@link FirebaseServerUserPasswordResetService} for managing password reset flows.
   */
  abstract passwordReset(): FirebaseServerUserPasswordResetService;

  /**
   * Converts a Firebase Admin {@link admin.auth.UserRecord} into a normalized {@link FirebaseAuthDetails} object.
   *
   * @param record - The user record to convert.
   */
  abstract authDetailsForRecord(record: admin.auth.UserRecord): FirebaseAuthDetails;
}

/**
 * Base implementation of {@link FirebaseServerAuthService} providing standard admin/ToS checks,
 * auth context creation with assertion, and a default no-op new user service.
 *
 * Subclasses must implement:
 * - {@link _context} - to create the concrete auth context type.
 * - {@link userContext} - to create the concrete user context type.
 * - {@link readRoles} - to define the claims-to-roles mapping.
 * - {@link claimsForRoles} - to define the roles-to-claims mapping.
 *
 * @example
 * ```typescript
 * export class MyAuthService extends AbstractFirebaseServerAuthService<MyUserContext, MyAuthContext> {
 *   protected _context(context: CallableContextWithAuthData): MyAuthContext {
 *     return new MyAuthContext(this, context);
 *   }
 *   userContext(uid: string): MyUserContext {
 *     return new MyUserContext(this, uid);
 *   }
 *   readRoles(claims: AuthClaims): AuthRoleSet {
 *     return MY_CLAIMS_SERVICE.toRoles(claims);
 *   }
 *   claimsForRoles(roles: AuthRoleSet): AuthClaimsUpdate {
 *     return MY_CLAIMS_SERVICE.toClaims(roles);
 *   }
 * }
 * ```
 */
export abstract class AbstractFirebaseServerAuthService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, C extends FirebaseServerAuthContext<U> = FirebaseServerAuthContext<U>> implements FirebaseServerAuthService<U, C> {
  private readonly _auth: admin.auth.Auth;

  constructor(auth: admin.auth.Auth) {
    this._auth = auth;
  }

  get auth(): admin.auth.Auth {
    return this._auth;
  }

  context(context: CallableContext): C {
    assertIsContextWithAuthData(context);
    return this._context(context);
  }

  protected abstract _context(context: CallableContextWithAuthData): C;

  abstract userContext(uid: FirebaseAuthUserId): U;

  isAdmin(claims: AuthClaims): boolean {
    return this.isAdminInRoles(this.readRoles(claims));
  }

  isAdminInRoles(roles: AuthRoleSet): boolean {
    return roles.has(AUTH_ADMIN_ROLE);
  }

  hasSignedTos(claims: AuthClaims): boolean {
    return this.hasSignedTosInRoles(this.readRoles(claims));
  }

  hasSignedTosInRoles(roles: AuthRoleSet): boolean {
    return roles.has(AUTH_TOS_SIGNED_ROLE);
  }

  abstract readRoles(claims: AuthClaims): AuthRoleSet;

  abstract claimsForRoles(roles: AuthRoleSet): AuthClaimsUpdate;

  newUser(): FirebaseServerNewUserService {
    return new NoSetupContentFirebaseServerNewUserService(this);
  }

  passwordReset(): FirebaseServerUserPasswordResetService {
    return new NoContentFirebaseServerUserPasswordResetService(this);
  }

  authContextInfo(context: AuthDataRef): Maybe<FirebaseAuthContextInfo> {
    const { auth } = context;
    let result: Maybe<FirebaseAuthContextInfo>;

    if (auth) {
      const _roles = cachedGetter(() => this.readRoles(auth.token as unknown as AuthClaims));
      const getClaims = <T extends AuthClaimsObject = AuthClaimsObject>() => auth.token as unknown as AuthClaims<T>;

      result = {
        uid: auth.uid,
        isAdmin: () => this.isAdminInRoles(_roles()),
        getClaims,
        getAuthRoles: _roles,
        token: firebaseAuthTokenFromDecodedIdToken(auth.token)
      };
    }

    return result;
  }

  authDetailsForRecord(record: admin.auth.UserRecord): FirebaseAuthDetails {
    return {
      uid: record.uid,
      email: record.email,
      emailVerified: record.emailVerified,
      phoneNumber: record.phoneNumber,
      disabled: record.disabled,
      displayName: record.displayName,
      photoURL: record.photoURL,
      creationTime: record.metadata.creationTime ? new Date(record.metadata.creationTime).toISOString() : undefined,
      lastSignInTime: record.metadata.lastSignInTime ? new Date(record.metadata.lastSignInTime).toISOString() : undefined,
      lastRefreshTime: record.metadata.lastRefreshTime ? new Date(record.metadata.lastRefreshTime).toISOString() : undefined
    };
  }
}
