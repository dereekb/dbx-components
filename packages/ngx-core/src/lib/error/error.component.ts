import { Component, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { ErrorInput, CodedError, convertToReadableError, ReadableError } from './error';

/**
 * Basic error component.
 */
@Component({
  selector: 'dbx-error',
  templateUrl: './error.component.html',
  styleUrls: ['./error.scss']
})
export class DbNgxReadableErrorComponent {

  private _error?: ReadableError;

  get error(): Maybe<ReadableError> {
    return this._error;
  }

  @Input()
  set error(error: Maybe<ErrorInput | ReadableError>) {
    this._error = convertToReadableError(error as any) as ReadableError;
  }

}
