import { Maybe, ServerError, ServerErrorResponse, ServerErrorResponseData } from '@dereekb/util';
import { FirebaseError } from 'firebase/app';

export class FirebaseServerError<T extends ServerErrorResponseData = ServerErrorResponseData> extends ServerErrorResponse<T> {
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

  constructor(readonly firebaseError: FirebaseError, serverError: ServerError<T>) {
    super(serverError);
  }

  get _error() {
    return this.firebaseError;
  }
}
