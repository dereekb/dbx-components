import { type HttpsError } from 'firebase-functions/lib/common/providers/https';
import { type ErrorMessageOrPartialServerError, isServerError, partialServerError, type ServerError, type StringErrorCode, type ThrowErrorFunction } from '@dereekb/util';
import * as functions from 'firebase-functions';
import type * as admin from 'firebase-admin';
import { type FirebaseErrorCode } from '@dereekb/firebase';

export const NO_AUTH_ERROR_CODE = 'NO_AUTH';

export function unauthenticatedContextHasNoAuthData() {
  return unauthenticatedError({
    message: 'expected auth',
    code: NO_AUTH_ERROR_CODE
  });
}

export const NO_UID_ERROR_CODE = 'NO_USER_UID';

export function unauthenticatedContextHasNoUidError() {
  return unauthenticatedError({
    message: 'no user uid',
    code: NO_UID_ERROR_CODE
  });
}

// MARK: General Errors
export const UNAUTHENTICATED_ERROR_CODE = 'UNAUTHENTICATED';

export function unauthenticatedError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('unauthenticated', serverError?.message || 'unauthenticated', {
    status: 401,
    code: UNAUTHENTICATED_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const FORBIDDEN_ERROR_CODE = 'FORBIDDEN';

export function forbiddenError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('permission-denied', serverError?.message || 'forbidden', {
    status: 403,
    code: FORBIDDEN_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const PERMISSION_DENIED_ERROR_CODE = 'PERMISSION_DENIED';

export function permissionDeniedError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('permission-denied', serverError?.message || 'permission denied', {
    status: 403,
    code: PERMISSION_DENIED_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const NOT_FOUND_ERROR_CODE = 'NOT_FOUND';

export function notFoundError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('not-found', serverError?.message || 'not found', {
    status: 404,
    code: NOT_FOUND_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const MODEL_NOT_AVAILABLE_ERROR_CODE = 'MODEL_NOT_AVAILABLE';

export function modelNotAvailableError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('not-found', serverError?.message || 'model was not available', {
    status: 404,
    code: MODEL_NOT_AVAILABLE_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const BAD_REQUEST_ERROR_CODE = 'BAD_REQUEST';

export function badRequestError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('invalid-argument', serverError?.message || 'bad request', {
    status: 400,
    code: BAD_REQUEST_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const CONFLICT_ERROR_CODE = 'CONFLICT';

export function preconditionConflictError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('failed-precondition', serverError?.message || 'conflict', {
    status: 409,
    code: CONFLICT_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const ALREADY_EXISTS_ERROR_CODE = 'ALREADY_EXISTS';

export function alreadyExistsError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('already-exists', serverError?.message || 'already exists', {
    status: 409,
    code: ALREADY_EXISTS_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const UNAVAILABLE_ERROR_CODE = 'UNAVAILABLE';

export function unavailableError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('unavailable', serverError?.message || 'service unavailable', {
    status: 503,
    code: UNAVAILABLE_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

export const INTERNAL_SERVER_ERROR_CODE = 'INTERNAL_ERROR';

export function internalServerError(messageOrError?: ErrorMessageOrPartialServerError) {
  const serverError = partialServerError(messageOrError);
  return new functions.https.HttpsError('internal', serverError?.message || 'internal error', {
    status: 500,
    code: INTERNAL_SERVER_ERROR_CODE,
    ...serverError,
    _error: undefined
  });
}

// MARK: Utility
export type FirebaseServerErrorInfoType = 'httpsError' | 'firebaseError' | 'unknown';

/**
 * Server error information
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

export function isFirebaseHttpsError(input: unknown | HttpsError): input is HttpsError {
  return typeof input === 'object' && (input as HttpsError).code != null && (input as HttpsError).httpErrorCode != null && (input as HttpsError).toJSON != null;
}

export function isFirebaseError(input: unknown | admin.FirebaseError): input is admin.FirebaseError {
  return typeof input === 'object' && (input as admin.FirebaseError).code != null && (input as admin.FirebaseError).message != null && (input as admin.FirebaseError).toJSON != null;
}

/**
 * Creates a FirebaseServerErrorInfo from the input.
 *
 * @param e
 * @returns
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

export function firebaseServerErrorInfoCodePair(e: unknown): [FirebaseErrorCode | undefined, FirebaseServerErrorInfo] {
  const info = firebaseServerErrorInfo(e);
  return [info.firebaseErrorCode, info];
}

export function firebaseServerErrorInfoServerErrorPair(e: unknown): [ServerError | undefined, FirebaseServerErrorInfo] {
  const info = firebaseServerErrorInfo(e);
  return [info.httpsErrorDetailsServerError, info];
}

export function firebaseServerErrorInfoServerErrorCodePair(e: unknown): [StringErrorCode | undefined, FirebaseServerErrorInfo] {
  const info = firebaseServerErrorInfo(e);
  return [info.serverErrorCode, info];
}

export function handleFirebaseError(e: unknown, handleFirebaseErrorFn: ThrowErrorFunction<admin.FirebaseError>): never | void {
  const firebaseError = (e as admin.FirebaseError).code ? (e as admin.FirebaseError) : undefined;

  if (firebaseError) {
    handleFirebaseErrorFn(firebaseError);
  }
}
