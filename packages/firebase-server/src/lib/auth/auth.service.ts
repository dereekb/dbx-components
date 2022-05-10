import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FirebaseAuthUserId } from '@dereekb/firebase';
import { cachedGetter, Maybe } from '@dereekb/util';
import { assertIsContextWithAuthData, CallableContextWithAuthData } from '../function/context';
import { FirebaseServerAuthCustomClaims } from './auth';
import { filterUndefinedValues } from '@dereekb/util';

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
   * Updates the claims for a user by merging existing claims in with the input.
   * 
   * All null values are cleared from the existing claims. Undefined values are ignored.
   * 
   * @param claims 
   */
  updateClaims(claims: FirebaseServerAuthCustomClaims): Promise<void>;

  /**
   * Sets the claims for a user. All previous claims are cleared.
   * 
   * @param claims 
   */
  setClaims(claims: FirebaseServerAuthCustomClaims): Promise<void>;

  /**
   * Clears all claims for the user.
   * 
   * @param claims 
   */
  clearClaims(): Promise<void>;

}

export abstract class AbstractFirebaseServerAuthUserContext<S extends FirebaseServerAuthService> implements FirebaseServerAuthUserContext {

  private readonly _loadRecord = cachedGetter(() => this.service.auth.getUser(this.uid));

  constructor(readonly service: S, readonly uid: FirebaseAuthUserId) { }

  loadRecord(): Promise<admin.auth.UserRecord> {
    return this._loadRecord();
  }

  loadClaims(): Promise<Maybe<FirebaseServerAuthCustomClaims>> {
    return this.loadRecord().then(x => x.customClaims);
  }

  async updateClaims(claims: FirebaseServerAuthCustomClaims): Promise<void> {
    const currentClaims = await this.loadClaims();

    let newClaims: FirebaseServerAuthCustomClaims;

    if (currentClaims) {
      newClaims = {
        ...claims,
        ...filterUndefinedValues(currentClaims)
      };
    } else {
      newClaims = claims;
    }

    return this.setClaims(newClaims);
  }

  setClaims(claims: FirebaseServerAuthCustomClaims): Promise<void> {
    return this.service.auth.setCustomUserClaims(this.uid, claims);
  }

  clearClaims(): Promise<void> {
    return this.service.auth.setCustomUserClaims(this.uid, null);
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

}

export abstract class AbstractFirebaseServerAuthContext<C extends FirebaseServerAuthContext, U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, S extends FirebaseServerAuthService<U, C> = FirebaseServerAuthService<U, C>> implements FirebaseServerAuthContext {

  private readonly _isAdmin = cachedGetter(() => this.service.isAdmin(this.context.auth.token));
  private readonly _userContext = cachedGetter(() => this.service.userContext(this.context.auth.uid));

  constructor(readonly service: S, readonly context: CallableContextWithAuthData) { }

  get userContext() {
    return this._userContext();
  }

  get isAdmin(): boolean {
    return this._isAdmin();
  }

  get token(): admin.auth.DecodedIdToken {
    return this.context.auth.token;
  }

  // MARK: FirebaseServerAuthUserContext
  get uid(): string {
    return this.userContext.uid;
  }

}

// MARK: Service
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
   */
  abstract isAdmin(claims: FirebaseServerAuthCustomClaims): boolean;

}

/**
 * Abstract FirebaseServerAuthService implementation.
 */
export abstract class AbstractFirebaseServerAuthService<U extends FirebaseServerAuthUserContext = FirebaseServerAuthUserContext, C extends FirebaseServerAuthContext<U> = FirebaseServerAuthContext<U>> implements FirebaseServerAuthService<U, C> {

  constructor(readonly auth: admin.auth.Auth) { }

  context(context: functions.https.CallableContext): C {
    assertIsContextWithAuthData(context);
    context.auth.token
    return this._context(context);
  }

  protected abstract _context(context: CallableContextWithAuthData): C;

  abstract userContext(uid: FirebaseAuthUserId): U;

  abstract isAdmin(claims: FirebaseServerAuthCustomClaims): boolean;

}
