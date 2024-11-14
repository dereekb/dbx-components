import { type Maybe, type ServerError, ServerErrorResponse, type ServerErrorResponseData } from '@dereekb/util';
import { type FirebaseError } from 'firebase/app';

export class FirebaseServerError<T extends ServerErrorResponseData = ServerErrorResponseData> extends ServerErrorResponse<T> {
  readonly firebaseError: FirebaseError;

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
