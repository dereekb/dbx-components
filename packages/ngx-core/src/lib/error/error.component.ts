import { Component, Input } from '@angular/core';
import { ErrorInput, CodedError, convertToReadableError, ReadableError } from './error';

/**
 * Basic error component.
 */
@Component({
  selector: 'dbngx-error',
  templateUrl: './error.component.html',
  styleUrls: ['./error.scss']
})
export class DbNgxReadableErrorComponent {

  private _error?: ReadableError;

  get error(): ReadableError | undefined {
    return this._error;
  }

  @Input()
  set error(error: ErrorInput | ReadableError | undefined) {
    this._error = convertToReadableError(error as any) as ReadableError;
  }

}
