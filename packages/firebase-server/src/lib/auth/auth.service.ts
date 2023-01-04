import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FirebaseAuthContextInfo, FirebaseAuthDetails, FirebaseAuthUserId, FirebaseAuthNewUserClaimsData, FirebaseAuthSetupPassword, FirebaseAuthResetUserPasswordClaimsData, FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY, FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY, FIREBASE_SERVER_AUTH_CLAIMS_RESET_PASSWORD_KEY, FIREBASE_SERVER_AUTH_CLAIMS_RESET_LAST_COM_DATE_KEY } from '@dereekb/firebase';
import { Milliseconds, filterUndefinedValues, AUTH_ADMIN_ROLE, AuthClaims, AuthRoleSet, cachedGetter, filterNullAndUndefinedValues, ArrayOrValue, AuthRole, forEachKeyValue, ObjectMap, AuthClaimsUpdate, asSet, KeyValueTypleValueFilter, AuthClaimsObject, Maybe, AUTH_TOS_SIGNED_ROLE, EmailAddress, E164PhoneNumber, randomNumberFactory, PasswordString } from '@dereekb/util';
import { assertIsContextWithAuthData, CallableContextWithAuthData } from '../function/context';
import { AuthDataRef, firebaseAuthTokenFromDecodedIdToken } from './auth.context';
import { hoursToMs, timeHasExpired, toISODateString } from '@dereekb/date';
import { getAuthUserOrUndefined } from './auth.util';

export const DEFAULT_FIREBASE_PASSWORD_NUMBER_GENERATOR = randomNumberFactory({ min: 100000, max: 1000000 - 1, round: 'floor' }); // 6 digits

export interface FirebaseServerAuthUserIdentifierContext {
  /**
   * UID of the user for this context.
   */
  readonly uid: FirebaseAuthUserId;
}

export interface FirebaseServerAuthResetUserPasswordClaims extends FirebaseAuthResetUserPasswordClaimsData, AuthClaimsObject {}

export interface FirebaseServerAuthUserContext extends FirebaseServerAuthUserIdentifierContext {
  /**
   * Returns true if the user exists.
   */
  exists(): Promise<boolean>;

  /**
   * Loads the record of the user.
   */
  loadRecord(): Promise<admin.auth.UserRecord>;

  /**
   * Loads the details object of the user.
   */
  loadDetails(): Promise<FirebaseAuthDetails>;

  /**
   * Generates a random reset token and updates the user's password to start a password reset flow.
   */
  beginResetPassword(): Promise<FirebaseServerAuthResetUserPasswordClaims>;

  /**
   * Returns the reset password claims if it exists.
   */
  loadResetPasswordClaims<T extends FirebaseServerAuthResetUserPasswordClaims = FirebaseServerAuthResetUserPasswordClaims>(): Promise<Maybe<T>>;

  /**
   * Changes the user's password. Will also clear any claims data related to resetting a password.
   */
  setPassword(password: PasswordString): Promise<admin.auth.UserRecord>;

  /**
   * Updates a user's information.
   */
  updateUser(template: admin.auth.UpdateRequest): Promise<admin.auth.UserRecord>;

  /**
   * Loads the roles of the user.
   */
  loadRoles(): Promise<AuthRoleSet>;

  /**
   * Adds the given roles to the user.
   *
   * @param roles
   */
  addRoles(roles: ArrayOrValue<AuthRole>): Promise<void>;

  /**
   * Removes the given roles from the user.
   *
   * @param roles
   */
  removeRoles(roles: ArrayOrValue<AuthRole>): Promise<void>;

  /**
   * Sets all the roles for the user.
   *
   * @param roles
   */
  setRoles(roles: AuthRole[] | AuthRoleSet): Promise<void>;

  /**
   * Loads the claims from the user.
   */
  loadClaims<T extends AuthClaimsObject = AuthClaimsObject>(): Promise<AuthClaims<T>>;

  /**
   * Updates the claims for a user by merging existing claims in with the input.
   *
   * All null values are cleared from the existing claims. Undefined values are ignored.
   *
   * @param claims
   */
  updateClaims<T extends AuthClaimsObject = AuthClaimsObject>(claims: AuthClaimsUpdate<T>): Promise<void>;

  /**
   * Sets the claims for a user. All previous claims are cleared.
   *
   * @param claims
   */
  setClaims<T extends AuthClaimsObject = AuthClaimsObject>(claims: AuthClaimsUpdate<T>): Promise<void>;

  /**
   * Clears all claims for the user.
   *
   * @param claims
   */
  clearClaims(): Promise<void>;
}

export abstract class AbstractFirebaseServerAuthUserContext<S extends FirebaseServerAuthService> implements FirebaseServerAuthUserContext {
  private readonly _loadRecord = cachedGetter(() => this.service.auth.getUser(this.uid));

  constructor(readonly service: S, readonly uid: FirebaseAuthUserId) {}

  async exists(): Promise<boolean> {
    return getAuthUserOrUndefined(this._loadRecord()).then((x) => Boolean(x));
  }

  loadRecord(): Promise<admin.auth.UserRecord> {
    return this._loadRecord();
  }

  loadDetails(): Promise<FirebaseAuthDetails> {
    return this.loadRecord().then((record) => this.service.authDetailsForRecord(record));
  }

  protected _generateResetPasswordKey(): string {
    return String(DEFAULT_FIREBASE_PASSWORD_NUMBER_GENERATOR());
  }

  async beginResetPassword(): Promise<FirebaseServerAuthResetUserPasswordClaims> {
    const password = this._generateResetPasswordKey();
    const passwordClaimsData: FirebaseServerAuthResetUserPasswordClaims = {
      [FIREBASE_SERVER_AUTH_CLAIMS_RESET_PASSWORD_KEY]: password,
      [FIREBASE_SERVER_AUTH_CLAIMS_RESET_LAST_COM_DATE_KEY]: toISODateString(new Date())
    };

    await this.updateUser({ password });
    await this.setPassword(passwordClaimsData.resetPassword);

    return passwordClaimsData;
  }

  async loadResetPasswordClaims<T extends FirebaseServerAuthResetUserPasswordClaims = FirebaseServerAuthResetUserPasswordClaims>(): Promise<Maybe<T>> {
    const claims = await this.loadClaims<T>();

    if (claims.resetPassword != null) {
      return claims;
    } else {
      return undefined;
    }
  }

  /**
   * Sets the user's password.
   */
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

  async setRoles(roles: AuthRole[] | AuthRoleSet): Promise<void> {
    const claims = this._claimsForRolesChange(Array.from(roles));
    return this.setClaims(claims);
  }

  protected _claimsForRolesChange(roles: ArrayOrValue<AuthRole>) {
    // filter null/undefined since the claims will contain null values for claims that are not related.
    return filterNullAndUndefinedValues(this.service.claimsForRoles(asSet(roles)));
  }

  loadClaims<T extends AuthClaimsObject = AuthClaimsObject>(): Promise<AuthClaims<T>> {
    return this.loadRecord().then((x) => (x.customClaims ?? {}) as AuthClaims<T>);
  }

  async updateClaims<T extends AuthClaimsObject = AuthClaimsObject>(claims: AuthClaimsUpdate<T>): Promise<void> {
    const currentClaims = await this.loadClaims();

    let newClaims: AuthClaimsUpdate<T>;

    if (currentClaims) {
      newClaims = {
        ...currentClaims,
        ...filterUndefinedValues(claims, false)
      };

      newClaims = filterNullAndUndefinedValues(newClaims);
    } else {
      newClaims = claims;
    }

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
export interface FirebaseServerAuthContext<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> extends FirebaseServerAuthUserIdentifierContext {
  /**
   * The wrapped context.
   */
  readonly context: CallableContextWithAuthData;

  /**
   * Returns the user context for this type.
   */
  readonly userContext: U;

  /**
   * Whether or not the context sees the user as an admin of the system.
   */
  readonly isAdmin: boolean;

  /**
   * Whether or not the context sees the user as having signed the terms of service.
   */
  readonly hasSignedTos: boolean;

  /**
   * The auth roles provided by the token in this context.
   */
  readonly authRoles: AuthRoleSet;

  /**
   * The token in the context.
   */
  readonly token: admin.auth.DecodedIdToken;

  /**
   * The claims in the context.
   */
  readonly claims: AuthClaims;
}

export abstract class AbstractFirebaseServerAuthContext<C extends FirebaseServerAuthContext, U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, S extends FirebaseServerAuthService<U, C> = FirebaseServerAuthService<U, C>> implements FirebaseServerAuthContext {
  private readonly _authRoles = cachedGetter(() => this.service.readRoles(this.claims));
  private readonly _isAdmin = cachedGetter(() => this.service.isAdminInRoles(this._authRoles()));
  private readonly _hasSignedTos = cachedGetter(() => this.service.hasSignedTosInRoles(this._authRoles()));
  private readonly _userContext = cachedGetter(() => this.service.userContext(this.context.auth.uid));

  constructor(readonly service: S, readonly context: CallableContextWithAuthData) {}

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
export interface FirebaseServerAuthNewUserClaims extends FirebaseAuthNewUserClaimsData, AuthClaimsObject {}

export interface FirebaseServerAuthInitializeNewUser<D = unknown> {
  /**
   * Specific user identifier to use.
   */
  readonly uid?: FirebaseAuthUserId;
  /**
   * User's display name
   */
  readonly displayName?: string;
  /**
   * Email for the new user, if applicable.
   */
  readonly email?: EmailAddress;
  /**
   * Phone for the new user, if applicable.
   */
  readonly phone?: E164PhoneNumber;
  /**
   * Password to set on the user if not created yet.
   *
   * This is a setup password and should not be the user's permenant/final password.
   */
  readonly setupPassword?: FirebaseAuthSetupPassword;
  /**
   * Whether or not to send a setup email. Is false by default.
   */
  readonly sendSetupContent?: boolean;
  /**
   * Whether or not to force sending the test details.
   */
  readonly sendDetailsInTestEnvironment?: boolean;
  /**
   * Any additional setup context
   */
  readonly data?: D;
}

export interface FirebaseServerAuthCreateNewUserResult {
  readonly user: admin.auth.UserRecord;
  readonly password: FirebaseAuthSetupPassword;
}

export interface FirebaseServerAuthNewUserSendSetupDetailsConfig<D = unknown> {
  /**
   * Whether or not to force sending the test details. Usage differs between providers.
   */
  readonly sendDetailsInTestEnvironment?: boolean;
  /**
   * Any additional setup context
   */
  readonly data?: D;
}

export interface FirebaseServerAuthNewUserSetupDetails<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, D = unknown> extends FirebaseServerAuthNewUserSendSetupDetailsConfig<D> {
  readonly userContext: U;
  readonly claims: FirebaseAuthNewUserClaimsData;
}

export interface FirebaseServerNewUserService<D = unknown, U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> {
  initializeNewUser(input: FirebaseServerAuthInitializeNewUser<D>): Promise<admin.auth.UserRecord>;
  /**
   * Adds setup claims to a user.
   *
   * @param userContextOrUid
   * @param setupPassword
   */
  addNewUserSetupClaims(userContextOrUid: U | FirebaseAuthUserId, setupPassword?: FirebaseAuthSetupPassword): Promise<U>;
  /**
   * Sends the setup content to the user. Returns true if content was sent or was already recently sent.
   *
   * @param uid
   */
  sendSetupContent(uid: FirebaseAuthUserId, data?: FirebaseServerAuthNewUserSendSetupDetailsConfig<D>): Promise<boolean>;
  /**
   * Loads the setup details for the user. If the user does not exist or does not need to be setup then undefined is returned.
   *
   * @param uid
   * @param config
   */
  loadSetupDetails(uid: FirebaseAuthUserId, config?: FirebaseServerAuthNewUserSendSetupDetailsConfig<D>): Promise<Maybe<FirebaseServerAuthNewUserSetupDetails<U, D>>>;
  /**
   * Loads the setup details for the input user context. If the user does not exist or does not need to be setup then undefined is returned.
   *
   * @param uid
   * @param config
   */
  loadSetupDetailsForUserContext(userContext: U, config?: FirebaseServerAuthNewUserSendSetupDetailsConfig<D>): Promise<Maybe<FirebaseServerAuthNewUserSetupDetails<U, D>>>;
  markUserSetupAsComplete(uid: FirebaseAuthUserId): Promise<boolean>;
}

/**
 * 1 hour
 */
export const DEFAULT_SETUP_COM_THROTTLE_TIME = hoursToMs(1);

export type UserContextOrUid<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> = U | FirebaseAuthUserId;

export function userContextFromUid<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext>(authService: FirebaseServerAuthService<U>, userContextOrUid: UserContextOrUid<U>): U {
  const userContext: U = typeof userContextOrUid === 'string' ? authService.userContext(userContextOrUid) : userContextOrUid;
  return userContext;
}

export abstract class AbstractFirebaseServerNewUserService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, C extends FirebaseServerAuthContext = FirebaseServerAuthContext, D = unknown> implements FirebaseServerNewUserService<D, U> {
  protected setupThrottleTime: Milliseconds = DEFAULT_SETUP_COM_THROTTLE_TIME;

  constructor(readonly authService: FirebaseServerAuthService<U, C>) {}

  async initializeNewUser(input: FirebaseServerAuthInitializeNewUser<D>): Promise<admin.auth.UserRecord> {
    const { uid, email, phone, sendSetupContent, data, sendDetailsInTestEnvironment } = input;

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

    if (!userRecord) {
      const createResult = await this.createNewUser(input);

      // add the setup password to the user's credentials
      const userContext = this.authService.userContext(createResult.user.uid);
      await this.addNewUserSetupClaims(userContext, createResult.password);

      // only send if true
      if (sendSetupContent === true) {
        await this.sendSetupContent(createResult.user.uid, { data, sendDetailsInTestEnvironment });
      }

      // return the new record
      userRecord = await userContext.loadRecord();
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

    if (setupDetails) {
      const { setupCommunicationAt } = setupDetails.claims;

      if (!setupCommunicationAt || timeHasExpired(new Date(setupCommunicationAt), this.setupThrottleTime)) {
        await this.sendSetupContentToUser(setupDetails);
        await this.updateSetupContentSentTime(setupDetails);
      }
    }

    return false;
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

  protected async updateSetupContentSentTime(details: FirebaseServerAuthNewUserSetupDetails<U, D>): Promise<void> {
    await details.userContext.updateClaims<FirebaseServerAuthNewUserClaims>({
      setupCommunicationAt: toISODateString(new Date())
    });
  }

  /**
   * Update a user's claims to clear any setup-related content.
   *
   * Returns true if a user was updated.
   *
   * @param uid
   */
  async markUserSetupAsComplete(uid: FirebaseAuthUserId): Promise<boolean> {
    const userContext = this.authService.userContext(uid);
    const userExists = await userContext.exists();

    if (userExists) {
      await this.updateClaimsToClearUser(userContext);
    }

    return userExists;
  }

  protected async createNewUser(input: FirebaseServerAuthInitializeNewUser<D>): Promise<FirebaseServerAuthCreateNewUserResult> {
    const { uid, displayName, email, phone: phoneNumber, setupPassword: inputPassword } = input;
    const password = inputPassword ?? this.generateRandomSetupPassword();

    const user = await this.authService.auth.createUser({
      uid,
      displayName,
      email,
      phoneNumber,
      password
    });

    return {
      user,
      password
    };
  }

  protected generateRandomSetupPassword(): FirebaseAuthSetupPassword {
    return `${DEFAULT_FIREBASE_PASSWORD_NUMBER_GENERATOR()}`;
  }

  protected abstract sendSetupContentToUser(user: FirebaseServerAuthNewUserSetupDetails<U, D>): Promise<void>;

  protected async updateClaimsToClearUser(userContext: U): Promise<void> {
    await userContext.updateClaims<FirebaseServerAuthNewUserClaims>({
      [FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY]: null,
      [FIREBASE_SERVER_AUTH_CLAIMS_SETUP_LAST_COM_DATE_KEY]: null
    });
  }
}

export class NoSetupContentFirebaseServerNewUserService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext> extends AbstractFirebaseServerNewUserService<U> {
  protected async sendSetupContentToUser(user: FirebaseServerAuthNewUserSetupDetails<U>): Promise<void> {
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
 * FirebaseServer auth service that provides accessors to auth-related components.
 */
export abstract class FirebaseServerAuthService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, C extends FirebaseServerAuthContext = FirebaseServerAuthContext> {
  abstract readonly auth: admin.auth.Auth;

  /**
   * Creates a context with the input CallableContext. This creation also asserts that a uid is available to the request.
   *
   * If the input context is not a CallableContextWithAuthData, an exception is thrown.
   *
   * @param context
   */
  abstract context(context: functions.https.CallableContext): C;

  /**
   * Creates a FirebaseServerAuthUserContext instance for the input uid.
   *
   * The user's existence is not checked.
   *
   * @param uid
   */
  abstract userContext(uid: FirebaseAuthUserId): U;

  /**
   * Whether or not the input claims indicate admin priviledges.
   *
   * @param claims
   */
  abstract isAdmin(claims: AuthClaims): boolean;

  /**
   * Whether or not the input claims indiciate the user has signed the ToS.
   *
   * @param claims
   */
  abstract hasSignedTos(claims: AuthClaims): boolean;

  /**
   * Whether or not the input roles indicate admin priviledges.
   *
   * @param roles
   */
  abstract isAdminInRoles(roles: AuthRoleSet): boolean;

  /**
   * Whether or not the input roles indiciate the user has signed the ToS.
   *
   * @param claims
   */
  abstract hasSignedTosInRoles(roles: AuthRoleSet): boolean;

  /**
   * Reads the AuthRoleSet from the input claims.
   *
   * @param claims
   */
  abstract readRoles(claims: AuthClaims): AuthRoleSet;

  /**
   * Creates the claims that reflect the input roles.
   *
   * The resultant claims value should include ALL claim values, with those that are unset to be null.
   *
   * @param roles
   */
  abstract claimsForRoles(roles: AuthRoleSet): AuthClaimsUpdate;

  /**
   * Builds a FirebaseAuthContextInfo for the input auth data context.
   *
   * @param context
   */
  abstract authContextInfo(context: AuthDataRef): Maybe<FirebaseAuthContextInfo>;

  /**
   * Returns the new user service to create a new user programmatically.
   */
  abstract newUser(): FirebaseServerNewUserService;

  /**
   * Returns the auth details for the given UserRecord.
   * @param record
   */
  abstract authDetailsForRecord(record: admin.auth.UserRecord): FirebaseAuthDetails;
}

/**
 * Abstract FirebaseServerAuthService implementation.
 */
export abstract class AbstractFirebaseServerAuthService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, C extends FirebaseServerAuthContext<U> = FirebaseServerAuthContext<U>> implements FirebaseServerAuthService<U, C> {
  constructor(readonly auth: admin.auth.Auth) {}

  context(context: functions.https.CallableContext): C {
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
      photoURL: record.photoURL
    };
  }
}

// MARK: Compat
export { FirebaseAuthNewUserClaimsData as FirebaseServerAuthNewUserClaimsData, FirebaseAuthSetupPassword as FirebaseServerAuthSetupPassword };
