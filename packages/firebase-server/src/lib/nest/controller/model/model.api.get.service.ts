import { type Maybe } from '@dereekb/util';
import { type FirestoreModelIdentity, type FirestoreModelKey, type FirestoreModelType } from '@dereekb/firebase';
import { Injectable, Inject, type INestApplicationContext } from '@nestjs/common';
import { type AbstractFirebaseNestContext } from '../../nest.provider';
import { type AuthData } from '../../../type';
import { ModelApiDispatchConfig, MODEL_API_NEST_APPLICATION_CONTEXT } from './model.api.dispatch';
import { type FirebaseServerAuthData } from '../auth.context.server';
import { firebaseServerErrorInfo } from '../../../function/error';

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
    message: serverMessage ?? httpsMessage ?? plainMessage ?? 'permission denied or not found',
    code
  };
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
  private _identityByModelType: Map<string, FirestoreModelIdentity> | undefined;

  constructor(@Inject(ModelApiDispatchConfig) config: ModelApiDispatchConfig, @Inject(MODEL_API_NEST_APPLICATION_CONTEXT) nestApplication: INestApplicationContext) {
    this._nestContext = config.makeNestContext(nestApplication) as AbstractFirebaseNestContext<any, any>;
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
