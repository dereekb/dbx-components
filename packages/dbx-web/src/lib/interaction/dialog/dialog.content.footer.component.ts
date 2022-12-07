import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';

/**
 * Component used to show a close button at the bottom of a dialog.
 */
@Component({
  selector: 'dbx-dialog-content-footer',
  template: `
    <button mat-raised-button (click)="closeClicked()">{{ closeText }}</button>
  `,
  host: {
    class: 'dbx-dialog-content-footer'
  }
})
export class DbxDialogContentFooterComponent implements OnDestroy {
  @Input()
  closeText = 'Close';

  @Output()
  readonly close = new EventEmitter<void>();

  closeClicked() {
    this.close.emit(undefined);
  }

  ngOnDestroy(): void {
    this.close.complete();
  }
}
