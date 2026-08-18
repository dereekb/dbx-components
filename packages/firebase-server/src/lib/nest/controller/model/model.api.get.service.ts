import { type Maybe } from '@dereekb/util';
import { type GrantedRoleMap, isFullAccessRoleMap, FULL_ACCESS_ROLE_KEY, NO_ACCESS_ROLE_KEY } from '@dereekb/model';
import { type FirebaseAuthUserId, type FirestoreModelIdentity, type FirestoreModelKey, type FirestoreModelType, type OidcModelScopeRequirement, type OidcScopeTerm, NOT_FOUND_ERROR_CODE, MODEL_NOT_AVAILABLE_ERROR_CODE, PERMISSION_DENIED_ERROR_CODE, FORBIDDEN_ERROR_CODE } from '@dereekb/firebase';
import { Injectable, Inject, type INestApplicationContext } from '@nestjs/common';
import { type AbstractFirebaseNestContext } from '../../nest.provider';
import { type AuthData } from '../../../type';
import { ModelApiDispatchConfig, MODEL_API_NEST_APPLICATION_CONTEXT } from './model.api.dispatch';
import { type FirebaseServerAuthData } from '../auth.context.server';
import { firebaseServerErrorInfo } from '../../../function/error';
import { assertModelApiOidcScope, oidcScopesFromModelApiAuth } from './model.api.scope';

// MARK: Types
/**
 * Maximum number of keys allowed in a multi-read request.
 */
export const MAX_MODEL_ACCESS_MULTI_READ_KEYS = 50;

/**
 * Result of a single document access read.
 */
export interface ModelAccessReadResult {
  readonly key: FirestoreModelKey;
  readonly data: unknown;
}

/**
 * Result of a multi-document access read.
 */
export interface ModelAccessMultiReadResult {
  readonly results: ModelAccessReadResult[];
  readonly errors: ModelAccessReadError[];
}

/**
 * Error for a single document in a multi-read request.
 */
export interface ModelAccessReadError {
  readonly key: FirestoreModelKey;
  readonly message: string;
  readonly code?: string;
}

/**
 * The resolved permission state for a single model key, as computed by that model's
 * `roleMapForModel()` delegate for a specific user.
 */
export interface ModelAccessRoleMapResult {
  readonly key: FirestoreModelKey;
  /**
   * Whether the underlying document exists.
   *
   * Roles are only computed for documents that exist — `FirebaseModelPermissionServiceInstance`
   * gates on `isUsableOutputForRoles(output) => output.exists`, so a missing document always
   * resolves to an empty role set. Surfacing existence separately is what lets a caller tell
   * "the document is not there" apart from "the document is there and you may not touch it";
   * both otherwise present as `roles: []`.
   */
  readonly exists: boolean;
  /**
   * True when the model granted the full-access marker ({@link FULL_ACCESS_ROLE_KEY}) rather than
   * an enumerated role set — the shape admin short-circuits like `fullAccessRoleMap()` produce.
   * When true, {@link roles} is empty and every role is implicitly granted.
   */
  readonly fullAccess: boolean;
  /**
   * The granted role names, sorted. Empty when {@link fullAccess} is true or nothing was granted.
   */
  readonly roles: string[];
}

/**
 * Result of a multi-key role-map resolution.
 */
export interface ModelAccessMultiRoleMapResult {
  /**
   * The uid the roles were resolved for — the caller's own uid unless the request targeted
   * another user. `undefined` for an unauthenticated resolution.
   */
  readonly uid?: string;
  /**
   * True when {@link uid} is someone other than the calling user.
   */
  readonly targeted: boolean;
  readonly results: ModelAccessRoleMapResult[];
  readonly errors: ModelAccessReadError[];
}

/**
 * Input for {@link ModelApiGetService.readRoleMaps}.
 */
export interface ModelAccessRoleMapParams {
  readonly modelType: FirestoreModelType;
  readonly keys: FirestoreModelKey[];
  /**
   * The calling request's auth data.
   */
  readonly auth: Maybe<FirebaseServerAuthData>;
  /**
   * Resolve roles as this user instead of the caller. Callers are responsible for authorizing
   * this before passing it — the service performs no permission check of its own on the target.
   */
  readonly targetUid?: Maybe<FirebaseAuthUserId>;
}

/**
 * Input for {@link modelAccessRoleMapResultFromGrantedRoles}.
 */
export interface ModelAccessRoleMapResultParams {
  readonly key: FirestoreModelKey;
  /**
   * The resolved `ContextGrantedModelRoles` for the key. Typed structurally (rather than importing
   * the generic) so the mapper stays testable with a plain object.
   */
  readonly granted: {
    readonly data?: Maybe<{ readonly exists?: boolean }>;
    readonly roleMap: GrantedRoleMap<string>;
  };
}

/**
 * Role-map keys that are structural markers rather than granted role names, so they are never
 * reported as roles.
 *
 * {@link FULL_ACCESS_ROLE_KEY} is surfaced through `fullAccess` instead. {@link NO_ACCESS_ROLE_KEY}
 * is what `noAccessRoleMap()` sets and means "no roles at all" — both a missing document and an
 * explicit no-access grant carry it, so leaking it would report `__EMPTY__` as a granted role and
 * make the no-access case indistinguishable from a real one-role grant.
 */
const MODEL_ACCESS_ROLE_MAP_MARKER_KEYS: ReadonlySet<string> = new Set<string>([FULL_ACCESS_ROLE_KEY, NO_ACCESS_ROLE_KEY]);

/**
 * Maps a resolved `ContextGrantedModelRoles` into the flat {@link ModelAccessRoleMapResult} wire
 * shape — collapsing the full-access marker into a boolean, dropping the structural marker keys, and
 * sorting the enumerated role keys so output is stable across calls.
 *
 * @param input - The key and its resolved granted-roles result.
 * @returns The flattened per-key permission state.
 */
export function modelAccessRoleMapResultFromGrantedRoles(input: ModelAccessRoleMapResultParams): ModelAccessRoleMapResult {
  const { key, granted } = input;
  const fullAccess = isFullAccessRoleMap(granted.roleMap);
  const roles = fullAccess
    ? []
    : Object.entries(granted.roleMap as Record<string, unknown>)
        .filter(([roleKey, value]) => value === true && !MODEL_ACCESS_ROLE_MAP_MARKER_KEYS.has(roleKey))
        .map(([roleKey]) => roleKey)
        .sort();

  return {
    key,
    exists: granted.data?.exists === true,
    fullAccess,
    roles
  };
}

/**
 * Shape of a single failed-key entry from `useMultipleModels({ throwOnFirstError: false })`.
 * Exposed so the mapper below stays testable without a live nest context.
 */
export interface ModelAccessUseMultipleModelsFailureEntry {
  readonly key: FirestoreModelKey;
  readonly error: unknown;
}

/**
 * Maps a single `useMultipleModels` failure entry into the public {@link ModelAccessReadError}
 * shape. Unwraps the typical Firebase error shapes via {@link firebaseServerErrorInfo} so
 * permission-denied / not-found errors surface a real message + code instead of the generic
 * `"Unknown error"` fallback the inline mapping used previously.
 *
 * When no real message survives, the fallback is derived from the resolved error `code` so the two
 * distinct outcomes stay distinguishable — a not-found read no longer reads as "permission denied"
 * (and vice-versa). Only when neither a message nor a recognizable code is present does it fall back
 * to a generic message.
 *
 * @param entry - A failed-key entry from the underlying multi-read.
 * @returns A `{ key, message, code? }` triple safe to return to API/MCP callers.
 */
export function modelAccessReadErrorFromUseMultipleModelsFailure(entry: ModelAccessUseMultipleModelsFailureEntry): ModelAccessReadError {
  const info = firebaseServerErrorInfo(entry.error);
  const serverMessage = info.httpsErrorDetailsServerError?.message;
  const httpsMessage = info.httpsError?.message;
  const plainMessage = entry.error instanceof Error ? entry.error.message : undefined;
  const code = info.serverErrorCode ?? info.firebaseErrorCode;

  return {
    key: entry.key,
    message: serverMessage ?? httpsMessage ?? plainMessage ?? modelAccessReadErrorMessageFromCode(code),
    code
  };
}

/**
 * Derives a fallback read-error message from a resolved error code, distinguishing not-found from
 * permission-denied. Accepts both the server-error form (`NOT_FOUND` / `MODEL_NOT_AVAILABLE` /
 * `PERMISSION_DENIED` / `FORBIDDEN`) and the Firebase HttpsError form (`not-found` /
 * `permission-denied`).
 *
 * `MODEL_NOT_AVAILABLE` is the code a missing document actually produces on this path — the
 * per-key existence check throws {@link nestFirebaseDoesNotExistError}, i.e. `modelNotAvailableError()`
 * — so it must map to not-found rather than falling through to the generic message.
 *
 * @param code - The resolved error code (`serverErrorCode ?? firebaseErrorCode`), if any.
 * @returns `'not found'`, `'permission denied'`, or a generic `'unknown error'` fallback.
 */
function modelAccessReadErrorMessageFromCode(code: Maybe<string>): string {
  let message: string;

  if (code === NOT_FOUND_ERROR_CODE || code === MODEL_NOT_AVAILABLE_ERROR_CODE || code === 'not-found') {
    message = 'not found';
  } else if (code === PERMISSION_DENIED_ERROR_CODE || code === FORBIDDEN_ERROR_CODE || code === 'permission-denied') {
    message = 'permission denied';
  } else {
    message = 'unknown error';
  }

  return message;
}

// MARK: Service
/**
 * Service for direct document reads using the `useModel()` permission-checking pattern.
 *
 * Unlike the dispatch service (which goes through callModel handlers), this service
 * reads documents directly from Firestore via {@link AbstractFirebaseNestContext.useModel},
 * enforcing `'read'` role permissions per document.
 */
@Injectable()
export class ModelApiGetService {
  private readonly _nestContext: AbstractFirebaseNestContext<any, any>;
  private readonly _defaultRequiredScope: Maybe<OidcScopeTerm>;
  private readonly _modelRequiredScopes: Maybe<Record<FirestoreModelType, OidcModelScopeRequirement>>;
  private _identityByModelType: Map<string, FirestoreModelIdentity> | undefined;

  constructor(@Inject(ModelApiDispatchConfig) config: ModelApiDispatchConfig, @Inject(MODEL_API_NEST_APPLICATION_CONTEXT) nestApplication: INestApplicationContext) {
    this._nestContext = config.makeNestContext(nestApplication) as AbstractFirebaseNestContext<any, any>;
    this._defaultRequiredScope = config.defaultRequiredScope;
    this._modelRequiredScopes = config.modelRequiredScopes;
  }

  /**
   * Enforces the OIDC read-scope requirement for a direct document read before it hits Firestore.
   *
   * A direct `/get` read is the `read` verb: it requires the per-verb `model.read` scope AND any
   * effective group term for the target model (per-model requirement > module default). This is the
   * ONLY gate on the direct-read path — it does not touch the callModel dispatch chain — so without it
   * an OIDC client scoped to a subset could read any model through `/get`. Non-OIDC callers bypass.
   *
   * @param modelType - The Firestore model type being read.
   * @param auth - The request's auth data (OIDC scopes are read from it).
   */
  private _assertReadScope(modelType: FirestoreModelType, auth: Maybe<FirebaseServerAuthData>): void {
    assertModelApiOidcScope({
      call: 'read',
      modelType,
      defaultRequiredScope: this._defaultRequiredScope,
      modelRequiredScopes: this._modelRequiredScopes,
      grantedScopes: oidcScopesFromModelApiAuth(auth)
    });
  }

  /**
   * Returns the registered {@link FirestoreModelIdentity} for the given `modelType` string, or
   * `undefined` when no model of that type is registered.
   *
   * Identities are read from `firebaseModelsService` and cached on first successful call. The
   * lookup uses the provided `auth` to build a real model context — `getFirestoreCollection(ctx)`
   * is context-dependent (calls `ctx.collection(...)` or similar), so a synthetic empty context
   * is not sufficient.
   *
   * @param modelType - The Firestore model type string (e.g., 'guestbook', 'profile').
   * @param auth - The request's auth data; used to build a context for the (one-time) lookup.
   * @returns The matching identity or `undefined`.
   */
  getModelIdentity(modelType: FirestoreModelType, auth: Maybe<FirebaseServerAuthData>): Maybe<FirestoreModelIdentity> {
    this._identityByModelType ??= this._buildIdentityMap(auth);
    return this._identityByModelType.get(modelType);
  }

  private _buildIdentityMap(auth: Maybe<FirebaseServerAuthData>): Map<string, FirestoreModelIdentity> {
    const map = new Map<string, FirestoreModelIdentity>();
    const authRef = this._makeAuthRef(auth);
    const inContextService = this._nestContext.model(authRef);
    const allTypes = inContextService.allTypes();

    for (const type of allTypes) {
      try {
        const modelService = inContextService(type as never) as unknown as { getFirestoreCollection: () => { modelIdentity: FirestoreModelIdentity } };
        const identity = modelService.getFirestoreCollection().modelIdentity;
        map.set(type, identity);
      } catch {
        // identity unavailable for this type — skipped silently. A subsequent get attempt for a
        // missing type surfaces a user-visible "Unknown modelType" error at the tool layer.
      }
    }

    return map;
  }

  /**
   * Reads a single document by model type and key with permission checking.
   *
   * @param modelType - The Firestore model type string (e.g., 'profile', 'guestbook').
   * @param key - The full Firestore model key (e.g., 'pr/abc123').
   * @param auth - The authenticated user's auth data from the request.
   * @returns The document key and data.
   * @throws {Error} Permission or not-found errors from useModel.
   */
  async readDocument(modelType: FirestoreModelType, key: FirestoreModelKey, auth: Maybe<FirebaseServerAuthData>): Promise<ModelAccessReadResult> {
    this._assertReadScope(modelType, auth);

    const authRef = this._makeAuthRef(auth);
    const doc = await this._nestContext.useModel(modelType as any, {
      request: authRef,
      key,
      roles: 'read',
      use: (x: any) => x.document
    });

    const snapshot = await doc.accessor.get();

    return {
      key,
      data: snapshot.data()
    };
  }

  /**
   * Reads multiple documents of the same model type with permission checking.
   *
   * Individual document errors (not-found, forbidden) are captured per-key
   * and returned in the errors array rather than throwing.
   *
   * @param modelType - The Firestore model type string.
   * @param keys - Array of Firestore model keys (max {@link MAX_MODEL_ACCESS_MULTI_READ_KEYS}).
   * @param auth - The authenticated user's auth data from the request.
   * @returns Results and errors for each requested key.
   */
  async readDocuments(modelType: FirestoreModelType, keys: FirestoreModelKey[], auth: Maybe<FirebaseServerAuthData>): Promise<ModelAccessMultiReadResult> {
    this._assertReadScope(modelType, auth);

    const authRef = this._makeAuthRef(auth);

    return this._nestContext.useMultipleModels(modelType as any, {
      request: authRef,
      keys: keys as any,
      roles: 'read',
      throwOnFirstError: false,
      use: async (successful: any[], failure: any) => {
        const results: ModelAccessReadResult[] = await Promise.all(
          successful.map(async (reader: any) => {
            const snapshot = await reader.document.accessor.get();

            return {
              key: reader.document.accessor.documentRef.path,
              data: snapshot.data()
            };
          })
        );

        const errors: ModelAccessReadError[] = failure.errors.map(modelAccessReadErrorFromUseMultipleModelsFailure);

        return { results, errors };
      }
    });
  }

  /**
   * Resolves the granted role map for one or more keys of the same model type — i.e. "what is this
   * user actually allowed to do with this document?".
   *
   * This is the same computation the permission-checked read path runs (`roleMapForModel()` on the
   * model's registered service factory), but the resolved roles are returned instead of being
   * consumed to allow/deny an operation. Because it runs the model's real delegate, derived and
   * cascading roles are included exactly as the API would grant them.
   *
   * Per-key failures are captured in `errors` rather than thrown, matching {@link readDocuments}.
   * A key that resolves to a missing document is NOT an error — it comes back with
   * `exists: false, roles: []`, which is what distinguishes "not there" from "no access".
   *
   * @param params - Model type, keys, calling auth, and an optional target uid.
   * @returns The per-key permission state plus the uid the roles were resolved for.
   */
  async readRoleMaps(params: ModelAccessRoleMapParams): Promise<ModelAccessMultiRoleMapResult> {
    const { modelType, keys, auth, targetUid } = params;
    this._assertReadScope(modelType, auth);

    const targeted = targetUid != null && targetUid !== auth?.uid;
    const authRef = targeted ? await this._makeAuthRefForUid(targetUid as FirebaseAuthUserId) : this._makeAuthRef(auth);
    const context = this._nestContext.makeModelContext(authRef);
    const service = (this._nestContext.firebaseModelsService as any)(modelType, context);

    const settled = await Promise.all(
      keys.map(async (key) => {
        let entry: { readonly result?: ModelAccessRoleMapResult; readonly error?: ModelAccessReadError };

        try {
          const granted = await service.roleMapForKey(key);
          entry = { result: modelAccessRoleMapResultFromGrantedRoles({ key, granted }) };
        } catch (error) {
          entry = { error: modelAccessReadErrorFromUseMultipleModelsFailure({ key, error }) };
        }

        return entry;
      })
    );

    const results: ModelAccessRoleMapResult[] = [];
    const errors: ModelAccessReadError[] = [];

    settled.forEach((entry) => {
      if (entry.result != null) {
        results.push(entry.result);
      } else if (entry.error != null) {
        errors.push(entry.error);
      }
    });

    const uid = authRef.auth?.uid;

    return {
      ...(uid == null ? {} : { uid }),
      targeted,
      results,
      errors
    };
  }

  /**
   * Builds a synthetic {@link AuthData} for an arbitrary uid so role resolution can run *as* that
   * user rather than as the caller.
   *
   * The target's custom claims are read from their Firebase Auth record and spread into the
   * synthetic token, mirroring how Firebase merges custom claims into a real decoded ID token —
   * so claim-reading permission delegates behave identically to a live request from that user.
   *
   * @param uid - The uid to resolve as.
   * @returns An auth ref carrying the target user's claims.
   * @throws {Error} If no Firebase Auth user exists for the uid.
   */
  private async _makeAuthRefForUid(uid: FirebaseAuthUserId): Promise<{ auth?: AuthData }> {
    const userContext = this._nestContext.authService.userContext(uid);
    const exists = await userContext.exists();

    if (!exists) {
      throw new Error(`No user exists with uid "${uid}".`);
    }

    const record = await userContext.loadRecord();

    return {
      auth: {
        uid,
        token: {
          ...record.customClaims,
          uid,
          sub: uid,
          email: record.email,
          email_verified: record.emailVerified
        }
      } as AuthData
    };
  }

  /**
   * Builds an {@link AuthDataRef} compatible with `useModel()` from the HTTP request auth.
   *
   * Uses the same synthetic auth pattern as {@link ModelApiDispatchService.dispatch}.
   * The OIDC-validated claim subset is layered over the base token so the synthetic
   * `auth.token` keeps standard JWT claims (`iat`, `auth_time`, `email`, …) that
   * downstream consumers like `authContextInfo` rely on.
   *
   * @param auth - The Firebase server auth data from the HTTP request, or undefined for unauthenticated requests.
   * @returns An object containing a synthetic {@link AuthData} for use with `useModel()`, or undefined auth.
   */
  private _makeAuthRef(auth: Maybe<FirebaseServerAuthData>): { auth?: AuthData } {
    let synthetic: AuthData | undefined;
    if (auth) {
      const baseToken = (auth as any).token ?? {};
      const oidcToken = (auth as any).oidcValidatedToken ?? {};
      synthetic = {
        uid: auth.uid,
        token: { ...baseToken, ...oidcToken }
      } as AuthData;
    }
    return { auth: synthetic };
  }
}
