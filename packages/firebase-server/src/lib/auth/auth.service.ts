import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FirebaseAuthContextInfo, FirebaseAuthUserId } from '@dereekb/firebase';
import { filterUndefinedValues, AUTH_ADMIN_ROLE, AuthClaims, AuthRoleSet, cachedGetter, filterNullAndUndefinedValues, ArrayOrValue, AuthRole, forEachKeyValue, ObjectMap, AuthClaimsUpdate, asSet, KeyValueTypleValueFilter, AuthClaimsObject, Maybe } from '@dereekb/util';
import { assertIsContextWithAuthData, CallableContextWithAuthData } from '../function/context';
import { AuthDataRef, firebaseAuthTokenFromDecodedIdToken } from './auth.context';

export interface FirebaseServerAuthUserIdentifierContext {
  /**
   * UID of the user for this context.
   */
  readonly uid: FirebaseAuthUserId;
}

export interface FirebaseServerAuthUserContext extends FirebaseServerAuthUserIdentifierContext {
  /**
   * Loads the record of the user.
   */
  loadRecord(): Promise<admin.auth.UserRecord>;

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
  updateClaims(claims: AuthClaimsUpdate): Promise<void>;

  /**
   * Sets the claims for a user. All previous claims are cleared.
   *
   * @param claims
   */
  setClaims(claims: AuthClaimsUpdate): Promise<void>;

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

  loadRecord(): Promise<admin.auth.UserRecord> {
    return this._loadRecord();
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
        claims[key] = null;
      },
      filter: KeyValueTypleValueFilter.NONE // hit all values
    });

    return this.updateClaims(claims);
  }

  protected _claimsForRolesChange(roles: ArrayOrValue<AuthRole>) {
    // filter null/undefined since the claims will contain null values for claims that are not related.
    return filterNullAndUndefinedValues(this.service.claimsForRoles(asSet(roles)));
  }

  loadClaims<T extends AuthClaimsObject = AuthClaimsObject>(): Promise<AuthClaims<T>> {
    return this.loadRecord().then((x) => (x.customClaims ?? {}) as AuthClaims<T>);
  }

  async updateClaims(claims: AuthClaimsUpdate): Promise<void> {
    const currentClaims = await this.loadClaims();

    let newClaims: AuthClaimsUpdate;

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

  setClaims(claims: AuthClaimsUpdate | null): Promise<void> {
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
  private readonly _isAdmin = cachedGetter(() => this.service.isAdmin(this.claims));
  private readonly _authRoles = cachedGetter(() => this.service.readRoles(this.claims));
  private readonly _userContext = cachedGetter(() => this.service.userContext(this.context.auth.uid));

  constructor(readonly service: S, readonly context: CallableContextWithAuthData) {}

  get userContext() {
    return this._userContext();
  }

  get isAdmin(): boolean {
    return this._isAdmin();
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
   * Whether or not the input roles indicate admin priviledges.
   *
   * @param roles
   */
  abstract isAdminInRoles(roles: AuthRoleSet): boolean;

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

  abstract readRoles(claims: AuthClaims): AuthRoleSet;

  abstract claimsForRoles(roles: AuthRoleSet): AuthClaimsUpdate;

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
        loadClaims: <T extends AuthClaimsObject = AuthClaimsObject>() => Promise.resolve(getClaims<T>()),
        loadAuthRoles: () => Promise.resolve(_roles()),
        token: firebaseAuthTokenFromDecodedIdToken(auth.token)
      };
    }

    return result;
  }
}
