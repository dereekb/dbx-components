import { type Maybe, type ServerError, ServerErrorResponse, type ServerErrorResponseData } from '@dereekb/util';
import { type FirebaseError } from 'firebase/app';

/**
 * Client-side representation of an error originating from a Firebase Cloud Function.
 *
 * Wraps a {@link FirebaseError} with structured server error details (status, message, code)
 * extracted from the error's `details` property. Extends {@link ServerErrorResponse} for
 * consistent error handling across the application.
 *
 * Typically created via {@link convertHttpsCallableErrorToReadableError} when an `HttpsCallable`
 * invocation fails with a server-side error that includes structured details.
 *
 * @example
 * ```ts
 * try {
 *   await callableFunction(data);
 * } catch (e) {
 *   if (e instanceof FirebaseServerError) {
 *     console.log(e.code, e.message, e.firebaseError.code);
 *   }
 * }
 * ```
 */
export class FirebaseServerError<T extends ServerErrorResponseData = ServerErrorResponseData> extends ServerErrorResponse<T> {
  readonly firebaseError: FirebaseError;

  /**
   * Creates a {@link FirebaseServerError} from a raw {@link FirebaseError}, extracting
   * structured error details from the error's `details` property if available.
   *
   * @param error - the Firebase error from an `HttpsCallable` failure
   */
  static fromFirebaseError(error: FirebaseError): FirebaseServerError {
    let details: Maybe<ServerError<ServerErrorResponseData>> = (error as Partial<{ details: ServerError }>).details;

    details = {
      status: 0,
      message: error.message || error.name,
      code: error.code,
      ...details
    };

    return new FirebaseServerError(error, details);
  }

  constructor(firebaseError: FirebaseError, serverError: ServerError<T>) {
    super(serverError);
    this.firebaseError = firebaseError;
  }

  get _error() {
    return this.firebaseError;
  }
}
