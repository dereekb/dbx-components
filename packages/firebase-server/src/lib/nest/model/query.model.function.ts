import { type Maybe, type PromiseOrValue, serverError } from '@dereekb/util';
import {
  type FirestoreModelType,
  type FirestoreModelIdentity,
  type FirestoreModelTypes,
  type OnCallQueryModelParams,
  type OnCallQueryModelRequestParams,
  type OnCallQueryModelResult,
  type ModelFirebaseCrudFunctionSpecifierRef,
  type FirestoreModelKey,
  DEFAULT_ON_CALL_QUERY_MODEL_LIMIT,
  MAX_ON_CALL_QUERY_MODEL_LIMIT,
  type FirestoreCollectionLike,
  type FirestoreQueryConstraint,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  startAfter,
  limit as limitConstraint,
  BAD_DOCUMENT_QUERY_CURSOR_ERROR_CODE,
  UNKNOWN_MODEL_TYPE_ERROR_CODE,
  FORBIDDEN_ERROR_CODE,
  MODEL_NOT_AVAILABLE_ERROR_CODE
} from '@dereekb/firebase';
import { badRequestError, firebaseServerErrorInfo } from '../../function/error';
import { type OnCallWithAuthAwareNestRequireAuthRef, type OnCallWithNestContext } from '../function/call';
import { type NestContextCallableRequestWithAuth, type NestContextCallableRequestWithOptionalAuth } from '../function/nest';
import { type AssertModelCrudRequestFunction } from './crud.assert.function';
import { _onCallWithCallTypeFunction } from './call.model.function';

// MARK: Function
/**
 * Request type for model query handlers that require authentication.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam I - The input data type for the query operation. Must extend {@link OnCallQueryModelRequestParams}.
 */
export type OnCallQueryModelRequest<N, I extends OnCallQueryModelRequestParams = OnCallQueryModelRequestParams> = NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;

/**
 * A model query handler function that requires an authenticated caller.
 */
export type OnCallQueryModelFunctionWithAuth<N, I extends OnCallQueryModelRequestParams = OnCallQueryModelRequestParams, O = unknown> = ((request: OnCallQueryModelRequest<N, I>) => PromiseOrValue<O>) & {
  readonly _requiresAuth?: true;
};

/**
 * Request type for model query handlers that allow unauthenticated callers.
 */
export type OnCallQueryModelRequestWithOptionalAuth<N, I extends OnCallQueryModelRequestParams = OnCallQueryModelRequestParams> = NestContextCallableRequestWithOptionalAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;

/**
 * A model query handler function that does not require authentication.
 *
 * Useful for public-facing query endpoints such as listing public content.
 */
export type OnCallQueryModelFunctionWithOptionalAuth<N, I extends OnCallQueryModelRequestParams = OnCallQueryModelRequestParams, O = unknown> = ((request: OnCallQueryModelRequestWithOptionalAuth<N, I>) => PromiseOrValue<O>) & {
  readonly _requireAuth: false;
};

/**
 * Standard model query handler requiring auth (the common case).
 */
export type OnCallQueryModelFunction<N, I extends OnCallQueryModelRequestParams = OnCallQueryModelRequestParams, O = unknown> = OnCallQueryModelFunctionWithAuth<N, I, O> & OnCallWithAuthAwareNestRequireAuthRef;

/**
 * Union of auth-required and optional-auth query handlers.
 */
export type OnCallQueryModelFunctionAuthAware<N, I extends OnCallQueryModelRequestParams = OnCallQueryModelRequestParams, O = unknown> = OnCallQueryModelFunction<N, I, O> | OnCallQueryModelFunctionWithOptionalAuth<N, I, O>;

/**
 * Maps Firestore model type strings to their query handler functions.
 *
 * Pass this map to {@link onCallQueryModel} to register all model types
 * that support querying through the call model system.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam T - The Firestore model identity constraining valid model type keys.
 */
export type OnCallQueryModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  readonly [K in FirestoreModelTypes<T>]?: OnCallQueryModelFunctionAuthAware<N, any, any>;
};

/**
 * Configuration for {@link onCallQueryModel}.
 */
export interface OnCallQueryModelConfig<N> {
  /**
   * Optional assertion run before the query handler; throw to reject.
   */
  readonly preAssert?: AssertModelCrudRequestFunction<N, OnCallQueryModelParams>;
}

/**
 * Factory that creates a callable function handling model queries for multiple model types.
 *
 * Dispatches to the correct handler based on the `modelType` field in the request,
 * enforces auth requirements per handler, and aggregates API details for MCP introspection.
 *
 * Query handlers receive filter/pagination params in the request data and should return
 * an {@link OnCallQueryModelResult} with paginated results. Use {@link executeOnCallQuery}
 * within handlers to handle cursor pagination automatically.
 *
 * @param map - Maps model type strings to their query handler functions.
 * @param config - Optional configuration including a pre-assertion hook.
 * @returns A callable function for the 'query' call type.
 *
 * @example
 * ```typescript
 * const queryHandler = onCallQueryModel<DemoNestContext>({
 *   profile: queryProfiles,
 *   guestbook: queryGuestbooks
 * });
 *
 * // Register as the 5th call type in onCallModel:
 * const callModel = onCallModel({
 *   create: onCallCreateModel({ ... }),
 *   read: onCallReadModel({ ... }),
 *   update: onCallUpdateModel({ ... }),
 *   delete: onCallDeleteModel({ ... }),
 *   query: queryHandler
 * });
 * ```
 */
export function onCallQueryModel<N>(map: OnCallQueryModelMap<N>, config: OnCallQueryModelConfig<N> = {}): OnCallWithNestContext<N, OnCallQueryModelParams, unknown> {
  const { preAssert } = config;

  return _onCallWithCallTypeFunction(map as any, {
    callType: 'query',
    crudType: 'query',
    preAssert: preAssert as any,
    throwOnUnknownModelType: queryModelUnknownModelTypeError
  }) as OnCallWithNestContext<N, OnCallQueryModelParams, unknown>;
}

/**
 * Creates a bad-request error indicating the requested model type is not valid for querying.
 *
 * @param modelType - The unrecognized model type string.
 * @returns A bad-request error with {@link UNKNOWN_MODEL_TYPE_ERROR_CODE} code.
 */
export function queryModelUnknownModelTypeError(modelType: FirestoreModelType) {
  return badRequestError(
    serverError({
      status: 400,
      code: UNKNOWN_MODEL_TYPE_ERROR_CODE,
      message: 'Invalid type to query.',
      data: {
        modelType
      }
    })
  );
}

/**
 * Creates a bad-request error indicating the cursor document key is invalid or inaccessible.
 *
 * @param cursorDocumentKey - The cursor document key that failed to resolve.
 * @returns A bad-request error with {@link BAD_DOCUMENT_QUERY_CURSOR_ERROR_CODE} code.
 */
export function queryModelBadCursorError(cursorDocumentKey: Maybe<FirestoreModelKey>) {
  return badRequestError(
    serverError({
      status: 400,
      code: BAD_DOCUMENT_QUERY_CURSOR_ERROR_CODE,
      message: 'The cursor document does not exist or is not accessible.',
      data: {
        cursorDocumentKey
      }
    })
  );
}

// MARK: Execute Query
/**
 * Configuration for {@link executeOnCallQuery}.
 *
 * @typeParam T - The Firestore document data type.
 * @typeParam R - The mapped result type for each document. Defaults to T.
 */
export interface ExecuteOnCallQueryConfig<T, R = T> {
  /**
   * The query request params containing limit and cursorDocumentKey.
   */
  readonly params: OnCallQueryModelRequestParams;
  /**
   * The Firestore collection to query against.
   *
   * Used for building queries (via {@link FirestoreQueryFactory}).
   */
  readonly collection: FirestoreCollectionLike<T>;
  /**
   * Loads and permission-checks the cursor document when {@link OnCallQueryModelRequestParams.cursorDocumentKey} is provided.
   *
   * This function must verify that the caller has read access to the cursor document.
   * Typically implemented using `nest.useModel()` which enforces permission checking.
   * Must return the document's snapshot for use with `startAfter`.
   *
   * If the cursor document does not exist or the caller lacks permission, this function
   * should throw an appropriate error (e.g., forbidden or not-found).
   *
   * @param cursorDocumentKey - The Firestore model key of the cursor document.
   * @returns A promise resolving to the cursor document's snapshot.
   *
   * @example
   * ```typescript
   * loadCursorDocument: async (key) => {
   *   const doc = await nest.useModel('guestbook', {
   *     request,
   *     key,
   *     roles: 'read',
   *     use: (x) => x.document
   *   });
   *   return doc.accessor.get();
   * }
   * ```
   */
  readonly loadCursorDocument: (cursorDocumentKey: FirestoreModelKey) => PromiseOrValue<DocumentSnapshot<T>>;
  /**
   * Builds query constraints to apply to the query.
   *
   * Return where/orderBy constraints here. Do NOT add limit or startAfter —
   * those are managed by {@link executeOnCallQuery} automatically.
   *
   * @returns Array of query constraints to apply. May be async if constraints depend on external data.
   */
  readonly buildConstraints: () => PromiseOrValue<FirestoreQueryConstraint[]>;
  /**
   * Optional maximum items per page override. Defaults to {@link MAX_ON_CALL_QUERY_MODEL_LIMIT}.
   *
   * The effective limit is: `min(params.limit ?? DEFAULT, maxLimit)`.
   */
  readonly maxLimit?: number;
  /**
   * Optional transform applied to each document snapshot's data before returning.
   *
   * Defaults to `snapshot.data()`.
   */
  readonly mapResult?: (snapshot: QueryDocumentSnapshot<T>) => R;
}

/**
 * Executes a paginated query using cursor-based pagination.
 *
 * Handles the mechanics of:
 * - Clamping the page limit to the configured maximum
 * - Resolving the cursor document key to a snapshot for `startAfter`
 * - Fetching one extra document to detect whether more results exist
 * - Building the {@link OnCallQueryModelResult} with cursorDocumentKey and hasMore
 *
 * @example
 * ```typescript
 * export const queryGuestbooks: DemoQueryModelFunction<QueryGuestbooksParams, OnCallQueryModelResult<Guestbook>> = async (request) => {
 *   const { nest, data } = request;
 *   return executeOnCallQuery({
 *     params: data,
 *     collection: nest.demoFirestoreCollections.guestbookCollection,
 *     loadCursorDocument: async (key) => {
 *       const doc = await nest.useModel('guestbook', { request, key, roles: 'read', use: (x) => x.document });
 *       return doc.accessor.get();
 *     },
 *     buildConstraints: () => {
 *       const constraints: FirestoreQueryConstraint[] = [];
 *       if (data.published != null) {
 *         constraints.push(where('published', '==', data.published));
 *       }
 *       constraints.push(orderBy('name', 'asc'));
 *       return constraints;
 *     }
 *   });
 * };
 * ```
 *
 * @param config - Query configuration including collection, constraints, and pagination params.
 * @returns Paginated query result with cursor for the next page.
 */
export async function executeOnCallQuery<T, R = T>(config: ExecuteOnCallQueryConfig<T, R>): Promise<OnCallQueryModelResult<R>> {
  const { params, collection, loadCursorDocument, buildConstraints, maxLimit = MAX_ON_CALL_QUERY_MODEL_LIMIT, mapResult } = config;

  // Clamp the limit
  const requestedLimit = params.limit ?? DEFAULT_ON_CALL_QUERY_MODEL_LIMIT;
  const effectiveLimit = Math.max(1, Math.min(requestedLimit, maxLimit));

  // Build constraints from caller + pagination
  const constraints: FirestoreQueryConstraint[] = await buildConstraints();

  // Resolve cursor to a document snapshot for startAfter.
  // The loadCursorDocument callback permission-checks the document via useModel.
  // We catch permission/not-found errors and normalize them to a cursor error
  // so the caller doesn't leak information about the document's existence.
  if (params.cursorDocumentKey) {
    let cursorSnapshot: DocumentSnapshot<T>;

    try {
      cursorSnapshot = await loadCursorDocument(params.cursorDocumentKey);
    } catch (e: unknown) {
      const errorInfo = firebaseServerErrorInfo(e);

      if (errorInfo.serverErrorCode === FORBIDDEN_ERROR_CODE || errorInfo.serverErrorCode === MODEL_NOT_AVAILABLE_ERROR_CODE) {
        throw queryModelBadCursorError(params.cursorDocumentKey);
      }

      throw e;
    }

    if (cursorSnapshot.data() === undefined) {
      throw queryModelBadCursorError(params.cursorDocumentKey);
    }

    constraints.push(startAfter(cursorSnapshot));
  }

  // Fetch one extra to detect hasMore
  constraints.push(limitConstraint(effectiveLimit + 1));

  // Execute via the collection's query factory
  const executableQuery = collection.query(...constraints);
  const querySnapshot = await executableQuery.getDocs();
  const docs = querySnapshot.docs;

  // Determine if there are more results
  const hasMore = docs.length > effectiveLimit;
  const resultDocs = hasMore ? docs.slice(0, effectiveLimit) : docs;

  // Build the result
  const results: R[] = resultDocs.map((doc) => (mapResult ? mapResult(doc) : (doc.data() as unknown as R)));
  const keys: FirestoreModelKey[] = resultDocs.map((doc) => doc.ref.path);
  const cursorDocumentKey: Maybe<FirestoreModelKey> = resultDocs.length > 0 ? resultDocs[resultDocs.length - 1].ref.path : undefined;

  return {
    results,
    keys,
    count: resultDocs.length,
    cursorDocumentKey,
    hasMore
  };
}
