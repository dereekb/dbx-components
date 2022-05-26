import { Component, Input } from '@angular/core';
import { Maybe, ErrorInput, toReadableError, ReadableError } from '@dereekb/util';

/**
 * Basic error component.
 */
@Component({
  selector: 'dbx-error',
  templateUrl: './error.component.html'
})
export class DbxReadableErrorComponent {
  private _error?: Maybe<ReadableError>;

  get error(): Maybe<ReadableError> {
    return this._error;
  }

  @Input()
  set error(error: Maybe<ErrorInput>) {
    this._error = toReadableError(error);
  }

  get message(): Maybe<string> {
    return this._error?.message;
  }
}
