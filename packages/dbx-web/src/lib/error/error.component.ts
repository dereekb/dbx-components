import { Component, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { ErrorInput, convertToReadableError, ReadableError } from '@dereekb/util';

/**
 * Basic error component.
 */
@Component({
  selector: 'dbx-error',
  templateUrl: './error.component.html'
})
export class DbxReadableErrorComponent {

  private _error?: ReadableError;

  get error(): Maybe<ReadableError> {
    return this._error;
  }

  @Input()
  set error(error: Maybe<ErrorInput | ReadableError>) {
    this._error = convertToReadableError(error as any) as ReadableError;
  }

  get message(): Maybe<string> {
    return this._error?.message;
  }

}
