import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { Maybe, ErrorInput, toReadableError, ReadableError, ReadableErrorWithCode, isDefaultReadableError } from '@dereekb/util';
import { DbxPopoverService } from '../interaction/popover/popover.service';
import { DbxErrorPopoverComponent } from './error.popover.component';

/**
 * Basic error component.
 */
@Component({
  selector: 'dbx-error',
  templateUrl: './error.component.html'
})
export class DbxReadableErrorComponent {
  @ViewChild('buttonPopoverOrigin', { read: ElementRef })
  buttonPopoverOrigin!: ElementRef;

  private _error?: Maybe<ReadableErrorWithCode>;

  constructor(readonly popoverService: DbxPopoverService) {}

  get error(): Maybe<ReadableError> {
    return this._error;
  }

  @Input()
  set error(error: Maybe<ErrorInput>) {
    this._error = toReadableError(error);
  }

  get isDefaultError() {
    return isDefaultReadableError(this._error);
  }

  get message(): Maybe<string> {
    return this._error?.message;
  }

  openErrorPopover() {
    if (this.error != null) {
      DbxErrorPopoverComponent.openPopover(this.popoverService, {
        origin: this.buttonPopoverOrigin,
        error: this.error
      });
    }
  }
}
