import { Component, Input } from '@angular/core';
import { ErrorInput, CodedError, ErrorUtility } from '@gae-web/appengine-utility';
import { AppError } from './error';

/**
 * Basic error component.
 */
@Component({
  selector: 'app-error',
  templateUrl: './error.component.html',
  styleUrls: ['./error.scss']
})
export class AppErrorComponent {

  private _error: AppError | CodedError;

  get errorData(): AppError | CodedError {
    return this._error;
  }

  @Input()
  set error(error: ErrorInput | AppError) {
    this._error = ErrorUtility.makeErrorData(error as any);
  }

}
