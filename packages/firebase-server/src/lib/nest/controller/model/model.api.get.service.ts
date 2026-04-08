import { type Maybe } from '@dereekb/util';
import { type FirestoreModelKey, type FirestoreModelType } from '@dereekb/firebase';
import { Injectable, Inject, type INestApplicationContext } from '@nestjs/common';
import { type AbstractFirebaseNestContext } from '../../nest.provider';
import { type AuthData } from '../../../type';
import { ModelApiDispatchConfig, MODEL_API_NEST_APPLICATION_CONTEXT } from './model.api.dispatch';
import { type FirebaseServerAuthData } from '../auth.context.server';

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

  constructor(@Inject(ModelApiDispatchConfig) config: ModelApiDispatchConfig, @Inject(MODEL_API_NEST_APPLICATION_CONTEXT) nestApplication: INestApplicationContext) {
    this._nestContext = config.makeNestContext(nestApplication) as AbstractFirebaseNestContext<any, any>;
  }

  /**
   * Reads a single document by model type and key with permission checking.
   *
   * @param modelType - The Firestore model type string (e.g., 'profile', 'guestbook').
   * @param key - The full Firestore model key (e.g., 'pr/abc123').
   * @param auth - The authenticated user's auth data from the request.
   * @returns The document key and data.
   * @throws Permission or not-found errors from useModel.
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

        const errors: ModelAccessReadError[] = failure.errors.map((e: any) => ({
          key: e.key,
          message: e.error?.message ?? 'Unknown error',
          code: e.error?.code
        }));

        return { results, errors };
      }
    });
  }

  /**
   * Builds an {@link AuthDataRef} compatible with `useModel()` from the HTTP request auth.
   *
   * Uses the same synthetic auth pattern as {@link ModelApiDispatchService.dispatch}.
   *
   * @param auth - The Firebase server auth data from the HTTP request, or undefined for unauthenticated requests.
   * @returns An object containing a synthetic {@link AuthData} for use with `useModel()`, or undefined auth.
   */
  private _makeAuthRef(auth: Maybe<FirebaseServerAuthData>): { auth?: AuthData } {
    return {
      auth: auth
        ? ({
            uid: auth.uid,
            token: (auth as any).oidcValidatedToken ?? (auth as any).token ?? {}
          } as AuthData)
        : undefined
    };
  }
}
