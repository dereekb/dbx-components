import { type ErrorMessageOrPartialServerError, isServerError, type Maybe, partialServerError, type ServerError, type StringErrorCode, type ThrowErrorFunction } from '@dereekb/util';
import type * as admin from 'firebase-admin';
import { DBX_FIREBASE_SERVER_NO_AUTH_ERROR_CODE, type FirebaseErrorCode } from '@dereekb/firebase';
import { HttpsError } from 'firebase-functions/https';

/**
 * Creates an unauthenticated {@link HttpsError} indicating the request context has no auth data.
 */
export function unauthenticatedContextHasNoAuthData() {
  return unauthenticatedError({
    message: 'expected auth',
    code: DBX_FIREBASE_SERVER_NO_AUTH_ERROR_CODE
  });
}

/**
 * Creates an unauthenticated {@link HttpsError} indicating the request context has no user UID.
 */
export function unauthenticatedContextHasNoUidError() {
  return unauthenticatedError({
    message: 'no user uid',
    code: DBX_FIREBASE_SERVER_NO_AUTH_ERROR_CODE
  });
}

// MARK: General Errors
/**
 * Standard error code constants and factory functions for creating typed {@link HttpsError} instances.
 *
 * Each factory wraps the Firebase `HttpsError` with a consistent shape: an HTTP status code,
 * a string error code, and an optional {@link ServerError} detail object.
 */
export const UNAUTHENTICATED_ERROR_CODE = 'UNAUTHENTICATED';

/** Creates an unauthenticated (401) {@link HttpsError}. */
export function unauthenticatedError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new HttpsError('unauthenticated', serverError?.message || 'unauthenticated', {
    status: 401,
    code: UNAUTHENTICATED_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const FORBIDDEN_ERROR_CODE = 'FORBIDDEN';

/** Creates a forbidden (403) {@link HttpsError}. */
export function forbiddenError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new HttpsError('permission-denied', serverError?.message || 'forbidden', {
    status: 403,
    code: FORBIDDEN_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const PERMISSION_DENIED_ERROR_CODE = 'PERMISSION_DENIED';

/** Creates a permission-denied (403) {@link HttpsError}. */
export function permissionDeniedError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new HttpsError('permission-denied', serverError?.message || 'permission denied', {
    status: 403,
    code: PERMISSION_DENIED_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const NOT_FOUND_ERROR_CODE = 'NOT_FOUND';

/** Creates a not-found (404) {@link HttpsError}. */
export function notFoundError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new HttpsError('not-found', serverError?.message || 'not found', {
    status: 404,
    code: NOT_FOUND_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const MODEL_NOT_AVAILABLE_ERROR_CODE = 'MODEL_NOT_AVAILABLE';

/** Creates a model-not-available (404) {@link HttpsError}, used when a Firestore document does not exist. */
export function modelNotAvailableError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new HttpsError('not-found', serverError?.message || 'model was not available', {
    status: 404,
    code: MODEL_NOT_AVAILABLE_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const BAD_REQUEST_ERROR_CODE = 'BAD_REQUEST';

/** Creates a bad-request (400) {@link HttpsError}. */
export function badRequestError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new HttpsError('invalid-argument', serverError?.message || 'bad request', {
    status: 400,
    code: BAD_REQUEST_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const CONFLICT_ERROR_CODE = 'CONFLICT';

/** Creates a precondition-conflict (409) {@link HttpsError}. */
export function preconditionConflictError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new HttpsError('failed-precondition', serverError?.message || 'conflict', {
    status: 409,
    code: CONFLICT_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const ALREADY_EXISTS_ERROR_CODE = 'ALREADY_EXISTS';

/** Creates an already-exists (409) {@link HttpsError}. */
export function alreadyExistsError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new HttpsError('already-exists', serverError?.message || 'already exists', {
    status: 409,
    code: ALREADY_EXISTS_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const UNAVAILABLE_ERROR_CODE = 'UNAVAILABLE';

/** Creates an unavailable (503) {@link HttpsError}. */
export function unavailableError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new HttpsError('unavailable', serverError?.message || 'service unavailable', {
    status: 503,
    code: UNAVAILABLE_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const UNAVAILABLE_OR_DEACTIVATED_FUNCTION_ERROR_CODE = 'UNAVAILABLE_OR_DEACTIVATED_FUNCTION';

/** Creates an unimplemented (501) {@link HttpsError} for deactivated or unavailable functions. */
export function unavailableOrDeactivatedFunctionError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new HttpsError('unimplemented', serverError?.message || 'the requested function is not available or has been deactivated for use', {
    status: 501,
    code: UNAVAILABLE_OR_DEACTIVATED_FUNCTION_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const INTERNAL_SERVER_ERROR_CODE = 'INTERNAL_ERROR';

/** Creates an internal-error (500) {@link HttpsError}. */
export function internalServerError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new HttpsError('internal', serverError?.message || 'internal error', {
    status: 500,
    code: INTERNAL_SERVER_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

// MARK: Utility
/**
 * Discriminator for the type of Firebase server error encountered.
 */
export type FirebaseServerErrorInfoType = 'httpsError' | 'firebaseError' | 'unknown';

/**
 * Structured information extracted from a caught Firebase server error.
 *
 * Provides typed access to the original error, Firebase error codes, and any
 * embedded {@link ServerError} details from {@link HttpsError} instances.
 */
export interface FirebaseServerErrorInfo {
  /**
   * Error type
   */
  readonly type: FirebaseServerErrorInfoType;
  /**
   * Original error
   */
  readonly e: unknown;
  /**
   * Firebase error code, if available.
   */
  readonly firebaseErrorCode?: FirebaseErrorCode;
  /**
   * Set if the error is a HttpsError
   */
  readonly httpsError?: HttpsError;
  /**
   * Set if the error is a HttpsError and a ServerError is provided.
   */
  readonly httpsErrorDetailsServerError?: ServerError;
  /**
   * StringErrorCode from httpsErrorDetailsServerError, if applicable.
   */
  readonly serverErrorCode?: StringErrorCode;
  /**
   * Set if the error is a FirebaseError
   */
  readonly firebaseError?: admin.FirebaseError;
}

/**
 * Type guard for Firebase {@link HttpsError} instances.
 */
export function isFirebaseHttpsError(input: unknown | HttpsError): input is HttpsError {
  return typeof input === 'object' && (input as HttpsError).code != null && (input as HttpsError).httpErrorCode != null && (input as HttpsError).toJSON != null;
}

/**
 * Type guard for Firebase Admin {@link admin.FirebaseError} instances.
 */
export function isFirebaseError(input: unknown | admin.FirebaseError): input is admin.FirebaseError {
  return typeof input === 'object' && (input as admin.FirebaseError).code != null && (input as admin.FirebaseError).message != null && (input as admin.FirebaseError).toJSON != null;
}

/**
 * Analyzes a caught error and extracts structured Firebase error information.
 *
 * Classifies the error as an {@link HttpsError}, {@link admin.FirebaseError}, or unknown,
 * and extracts any embedded error codes and {@link ServerError} details.
 *
 * @param e - The caught error to analyze.
 *
 * @example
 * ```typescript
 * try {
 *   await someFirebaseOperation();
 * } catch (e) {
 *   const info = firebaseServerErrorInfo(e);
 *   if (info.serverErrorCode === 'MODEL_NOT_AVAILABLE') { ... }
 * }
 * ```
 */
export function firebaseServerErrorInfo(e: unknown): FirebaseServerErrorInfo {
  let type: FirebaseServerErrorInfoType = 'unknown';
  let httpsError: HttpsError | undefined;
  let firebaseError: admin.FirebaseError | undefined;
  let firebaseErrorCode: FirebaseErrorCode | undefined;
  let httpsErrorDetailsServerError: ServerError | undefined;
  let serverErrorCode: StringErrorCode | undefined;

  if (e != null) {
    if (isFirebaseHttpsError(e)) {
      type = 'httpsError';
      httpsError = e;
      firebaseErrorCode = httpsError.code as FirebaseErrorCode;

      if (httpsError.details && isServerError(httpsError.details)) {
        httpsErrorDetailsServerError = httpsError.details;
        serverErrorCode = httpsErrorDetailsServerError.code as StringErrorCode;
      }
    } else if (isFirebaseError(e)) {
      type = 'firebaseError';
      firebaseError = e;
      firebaseErrorCode = firebaseError.code as FirebaseErrorCode;
    }
  }

  return {
    httpsError,
    firebaseError,
    firebaseErrorCode,
    httpsErrorDetailsServerError,
    serverErrorCode,
    type,
    e
  };
}

/**
 * Returns a tuple of [firebaseErrorCode, errorInfo] for pattern-matching on Firebase error codes.
 */
export function firebaseServerErrorInfoCodePair(e: unknown): [Maybe<FirebaseErrorCode>, FirebaseServerErrorInfo] {
  const info = firebaseServerErrorInfo(e);
  return [info.firebaseErrorCode, info];
}

/**
 * Returns a tuple of [serverError, errorInfo] for pattern-matching on embedded server error details.
 */
export function firebaseServerErrorInfoServerErrorPair(e: unknown): [Maybe<ServerError>, FirebaseServerErrorInfo] {
  const info = firebaseServerErrorInfo(e);
  return [info.httpsErrorDetailsServerError, info];
}

/**
 * Returns a tuple of [serverErrorCode, errorInfo] for pattern-matching on server error string codes.
 */
export function firebaseServerErrorInfoServerErrorCodePair(e: unknown): [Maybe<StringErrorCode>, FirebaseServerErrorInfo] {
  const info = firebaseServerErrorInfo(e);
  return [info.serverErrorCode, info];
}

/**
 * Handles a caught error if it is a Firebase Admin error, passing it to the given handler function.
 *
 * If the error is not a Firebase error (no `code` property), this is a no-op.
 *
 * @param e - The caught error.
 * @param handleFirebaseErrorFn - Handler that receives the typed {@link admin.FirebaseError}.
 */
export function handleFirebaseError(e: unknown, handleFirebaseErrorFn: ThrowErrorFunction<admin.FirebaseError>): never | void {
  const firebaseError = (e as admin.FirebaseError).code ? (e as admin.FirebaseError) : undefined;

  if (firebaseError) {
    handleFirebaseErrorFn(firebaseError);
  }
}
