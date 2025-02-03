import { Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { type Maybe } from '@dereekb/util';

export interface DbxErrorViewButtonEvent {
  readonly origin: ElementRef;
}

/**
 * The basic error view.
 */
@Component({
  selector: 'dbx-error-view',
  templateUrl: './error.view.component.html',
  host: {
    class: 'dbx-error dbx-warn dbx-b'
  }
})
export class DbxErrorViewComponent implements OnDestroy {
  @Input()
  icon = 'error';

  @Input()
  message?: Maybe<string>;

  /**
   * Whether or not the error button is disabled.
   */
  @Input()
  buttonDisabled?: Maybe<boolean>;

  @Output()
  readonly buttonClick = new EventEmitter<DbxErrorViewButtonEvent>();

  @ViewChild('buttonPopoverOrigin', { read: ElementRef })
  buttonOrigin!: ElementRef;

  constructor() {}

  ngOnDestroy(): void {
    this.buttonClick.complete();
  }

  clickError() {
    if (!this.buttonDisabled) {
      this.buttonClick.emit({
        origin: this.buttonOrigin
      });
    }
  }
}
